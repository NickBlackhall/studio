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

const ch = supa.channel('smoke:games');
let got = false;

ch.on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => { got = true; });
console.log('Attempting to subscribe to Realtime channel...');
const status = await ch.subscribe();
console.log('Subscription status:', status);

if (status !== 'SUBSCRIBED') {
  console.error('Realtime not SUBSCRIBED. Status:', status);
  console.error('Channel state:', ch.state);
  console.error('Socket ready state:', ch.socket.conn.readyState);
  console.error('Socket URL:', ch.socket.conn.url);
  
  // Wait a bit and check if it's a timing issue
  console.log('Waiting 3 seconds and checking again...');
  await new Promise(r => setTimeout(r, 3000));
  console.log('Channel state after wait:', ch.state);
  console.log('Socket ready state after wait:', ch.socket.conn.readyState);
  
  if (ch.state !== 'joined') {
    console.error('Realtime failed to connect after waiting');
    process.exit(2);
  }
}

// Touch something unlikely to match: no-op update for smoke gate
await supa.rpc('pg_sleep', { seconds: 0 }); // harmless nudge (optional)
await new Promise(r => setTimeout(r, 250)); // allow server settle

const { error } = await supa.from('games').update({ updated_at: new Date().toISOString() }).eq('room_code', 'T__noexist__');
if (error) console.warn('Update error (harmless if no rows):', error.message);

// Wait up to 5s for any event (may be 0 if no rows matched; this is just a subscribe/signal gate)
await new Promise((resolve, reject) => {
  const t = setTimeout(() => (got ? resolve() : reject(new Error('No realtime events observed'))), 5000);
  if (got) { clearTimeout(t); resolve(); }
});

await supa.removeChannel(ch);
console.log('Realtime smoke OK');