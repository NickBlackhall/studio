import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supa = createClient(url, key, { realtime: { params: { eventsPerSecond: 1000 } } });

// Create dedicated smoke test table to ensure deterministic event generation.
// The CI workflow also creates this table via psql before running this script;
// this RPC is a fallback for local runs, so a failure here is only a warning.
const { error: rpcError } = await supa.rpc('create_smoke_test_table');
if (rpcError) {
  console.warn('create_smoke_test_table RPC failed (table may already exist from schema setup):', rpcError.message);
}

const ch = supa.channel('smoke:rt_smoke');
let got = false;

ch.on('postgres_changes', { event: '*', schema: 'public', table: 'rt_smoke' }, (payload) => {
  console.log('event received:', payload.eventType, payload);
  got = true;
});

console.log('Attempting to subscribe to Realtime channel...');
await new Promise((resolve, reject) => {
  let done = false;
  ch.subscribe((status) => {
    console.log('subscribe:', status);
    if (status === 'SUBSCRIBED' && !done) { 
      done = true; 
      resolve(); 
    }
    if ((status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') && !done) {
      done = true; 
      reject(new Error('Subscribe failed: ' + status));
    }
  });
  setTimeout(() => !done && reject(new Error('Subscribe timeout')), 15000);
});

// Allow subscription to fully establish
await new Promise(r => setTimeout(r, 1000));

// Generate events until one is delivered. Two failure modes to ride out:
// - PostgREST schema cache reloads (insert fails with PGRST205)
// - Realtime's WAL poller warming up on a cold instance: the first event
//   after the first postgres_changes subscription can take >10s to arrive,
//   so a single insert with a short wait produces false negatives.
console.log('Generating deterministic Realtime events (up to 30s)...');
const deadline = Date.now() + 30_000;
let attempt = 0;
let anyInsertOk = false;
let lastError = null;
while (!got && Date.now() < deadline) {
  attempt++;
  const { error } = await supa.from('rt_smoke').insert({
    test_value: `smoke-${attempt}-${Date.now()}`
  });
  if (error) {
    lastError = error;
    console.warn(`insert attempt ${attempt} failed: ${error.message}`);
  } else {
    anyInsertOk = true;
    console.log(`insert attempt ${attempt} ok, waiting for event...`);
  }
  // Poll for delivery for 3s before generating the next event
  for (let i = 0; i < 30 && !got; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
}

if (!anyInsertOk) {
  console.error('All inserts failed; last error:', lastError);
  process.exit(3);
}
if (!got) {
  console.error('No realtime events received within 30s despite successful INSERTs');
  process.exit(4);
}

await supa.removeChannel(ch);
console.log('Realtime smoke OK');