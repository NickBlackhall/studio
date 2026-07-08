import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export async function openSubscribedChannel(
  client: SupabaseClient,
  name: string,
  setup: (ch: RealtimeChannel) => void | RealtimeChannel
): Promise<RealtimeChannel> {
  const ch = client.channel(name);
  const maybe = setup(ch);
  const channel = (maybe as RealtimeChannel) || ch;
  // subscribe() returns the channel, not a status — wait for the status callback
  await new Promise<void>((resolve, reject) => {
    let done = false;
    channel.subscribe((status) => {
      if (done) return;
      if (status === 'SUBSCRIBED') { done = true; resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        done = true;
        reject(new Error(`Channel not subscribed: ${status}`));
      }
    });
    setTimeout(() => { if (!done) { done = true; reject(new Error('Channel subscribe timeout')); } }, 15_000);
  });
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