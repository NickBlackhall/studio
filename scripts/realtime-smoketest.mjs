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

// Create dedicated smoke test table to ensure deterministic event generation
await supa.rpc('create_smoke_test_table');

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

// Guaranteed event generation: INSERT a test row
console.log('Generating deterministic Realtime event...');
const { data, error } = await supa.from('rt_smoke').insert({ 
  test_value: 'smoke-' + Date.now() 
}).select().single();

if (error) {
  console.error('Failed to insert smoke test row:', error);
  process.exit(3);
}

console.log('insert ok:', data);

// Wait up to 3s for the guaranteed event
await new Promise((resolve, reject) => {
  const t = setTimeout(() => {
    if (got) {
      resolve();
    } else {
      reject(new Error('No realtime events received despite successful INSERT'));
    }
  }, 3000);
  
  // Early resolution if event received
  const checkInterval = setInterval(() => {
    if (got) {
      clearTimeout(t);
      clearInterval(checkInterval);
      resolve();
    }
  }, 100);
});

await supa.removeChannel(ch);
console.log('Realtime smoke OK');