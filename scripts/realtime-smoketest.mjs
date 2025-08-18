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
const status = await ch.subscribe();
if (status !== 'SUBSCRIBED') {
  console.error('Realtime not SUBSCRIBED:', status);
  process.exit(2);
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