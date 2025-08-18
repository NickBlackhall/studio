import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const anonSupabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 1000 } },
});
export const testSupabase = createClient(url, service, {
  realtime: { params: { eventsPerSecond: 1000 } },
});