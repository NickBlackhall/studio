import { setPlayerSession } from '../../src/lib/auth';

/**
 * Run an async action with its own isolated session, like a separate browser.
 * Needed for tests that fire concurrent server-action calls as different
 * players — self-only actions (togglePlayerReadyStatus, submitResponse)
 * verify the session player matches the acting player, so the calls can't
 * share the global mock cookie store.
 *
 * Relies on the AsyncLocalStorage cookie scope installed by
 * tests/setup/jest.node.setup.ts.
 */
export async function runWithSession<T>(
  playerId: string,
  gameId: string,
  role: 'player' | 'judge' | 'host',
  fn: () => Promise<T>
): Promise<T> {
  const scope = (globalThis as any).__runWithCookieScope as <R>(f: () => Promise<R>) => Promise<R>;
  return scope(async () => {
    await setPlayerSession(playerId, gameId, role);
    return fn();
  });
}
