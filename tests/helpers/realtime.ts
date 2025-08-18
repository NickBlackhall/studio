import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export async function openSubscribedChannel(
  client: SupabaseClient,
  name: string,
  setup: (ch: RealtimeChannel) => void | RealtimeChannel
): Promise<RealtimeChannel> {
  const ch = client.channel(name);
  const maybe = setup(ch);
  const channel = (maybe as RealtimeChannel) || ch;
  const status = await channel.subscribe(); // supabase-js v2.43.5 resolves on 'SUBSCRIBED'
  if (status !== 'SUBSCRIBED') throw new Error(`Channel not subscribed: ${status}`);
  return channel;
}

export function nextEvent<T = any>(channel: RealtimeChannel, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for event`)), timeoutMs);
    channel.on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
      clearTimeout(t);
      resolve(payload as T);
    });
  });
}