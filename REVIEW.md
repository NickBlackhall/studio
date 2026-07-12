# Codebase Review — Make It Terrible

**Reviewer**: Claude Sonnet 4.6  
**Date**: 2026-06-13  
**Commit**: e5d659c (HEAD, master)  
**Backend note**: Supabase project is suspended. DB policies audited from `supabase/migrations/` and `database/` SQL files only. Items requiring live verification are called out explicitly at the end.

---

## Architecture Map

Before findings: here is the structural model this review is based on.

```
Browser (untrusted)
    │
    ├── src/app/page.tsx          — Lobby / welcome (client component)
    ├── src/app/game/page.tsx     — Active game (client component)
    │
    ▼ server actions (Next.js "use server")
    src/app/game/actions.ts       — ALL mutations: addPlayer, startGame,
                                    submitResponse, selectWinner, nextRound,
                                    removePlayerFromGame, resetGameForTesting,
                                    setCurrentPlayerSession, …
    │
    ├── src/lib/auth.ts           — JWT session management (HTTP-only cookie)
    ├── src/lib/gameAuth.ts       — DB-integrated authz helpers
    └── src/lib/supabaseClient.ts — Single Supabase anon-key client
                                    (shared by server actions AND client)
    │
    ▼ Supabase (PostgreSQL + Realtime)
    games, players, player_hands, responses, response_cards,
    scenarios, winners
    ── NO RLS policies anywhere in migrations ──
```

**State sync model**: Client holds `GameClientState` in `SharedGameContext`. On any DB change, a Postgres realtime subscription fires → `getGame(gameId)` is called server-side → full updated state returned and merged into React state. No optimistic-only writes.

**Auth model (current)**: A server-side JWT cookie (`game-session`) carries `{ playerId, gameId, role }`. Every security-sensitive server action calls `requireAuthOrDev(gameId, () => requireXxxAccess(gameId))`, which verifies the cookie and then validates against the DB. **However**, there are several critical gaps in this model described below.

---

## Findings

---

### CRITICAL — Security

---

**C-1 `setCurrentPlayerSession` issues a JWT for any caller-supplied identity**  
*Security · src/app/game/actions.ts:1362–1365 and src/lib/auth.ts:74–88*

This server action accepts `playerId`, `gameId`, and `role` from the caller and immediately creates and sets a signed JWT cookie — with no check that the caller actually owns `playerId` or is a member of `gameId`.

```typescript
export async function setCurrentPlayerSession(
  playerId: string,  // ← caller-controlled, unvalidated
  gameId: string,
  role: 'player' | 'judge' | 'host' = 'player'
): Promise<void> {
  await setPlayerSession(playerId, gameId, role);  // signs JWT, sets cookie
}
```

Any browser can:
1. Call Supabase directly with the public anon key to list all player IDs.
2. Call `setCurrentPlayerSession(victimPlayerId, gameId, 'host')`.
3. Now hold a valid `host`-role JWT and perform any host action (kick, reset, start).

**Fix**: Remove the `setCurrentPlayerSession` public server action entirely. Session establishment must only happen during `addPlayer` on the same server-side call that creates the DB row, under a server-generated nonce. The client should never be able to supply the `playerId` for session creation.

**Confidence**: Certain.

---

**C-2 No Row Level Security on any table**  
*Security · database/migrations/001\_add\_room\_codes\_supabase.sql, 002\_add\_transition\_state.sql, database/test-schema.sql*

None of the migrations define RLS policies. The Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is embedded in the client JS bundle. Any user can open the browser console and:

```javascript
const { createClient } = supabase
const db = createClient(url, anonKey)
// Read every player's cards:
await db.from('player_hands').select('*, response_cards(text)')
// Alter any score:
await db.from('players').update({ score: 99 }).eq('game_id', anyGameId)
// Delete any game:
await db.from('games').delete().eq('id', anyGameId)
```

All server-action authorization checks are irrelevant without RLS because they can be bypassed entirely by talking to Supabase directly.

**Fix**: Enable RLS on every table. Minimum policies needed: games (SELECT public, INSERT/UPDATE/DELETE via service role only), players (SELECT within same `game_id`, UPDATE own row only), player_hands (SELECT/UPDATE/DELETE own `player_id` only), responses (SELECT within same `game_id`, INSERT own `player_id`). Server actions should use a `SUPABASE_SERVICE_ROLE_KEY` client, not the anon client.

**Confidence**: Certain — confirmed absence of `CREATE POLICY` or `ALTER TABLE … ENABLE ROW LEVEL SECURITY` in all SQL files.

---

**C-3 JWT_SECRET has a hardcoded fallback**  
*Security · src/lib/auth.ts:12*

```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-fallback-secret-key'
);
```

Any deployment where `JWT_SECRET` is not set uses the literal string `'your-fallback-secret-key'`. An attacker who knows (or guesses) this fallback can forge valid session tokens offline and claim any `playerId`/`role` combination.

**Fix**: Throw at startup: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')`. Remove the fallback entirely.

**Confidence**: Certain.

---

**C-4 `getGame` returns ALL players' card hands to every caller**  
*Security · src/app/game/actions.ts:167–212*

`getGame` fetches all rows from `player_hands` for all players in the game and returns them as `players[N].hand` in the `GameClientState`. Every client that calls `getGame` (including via the real-time subscription debounce at `SharedGameContext.tsx:263`) receives the full hand of every opponent.

In a card-game context this is a game-integrity failure: a player can open React DevTools or log `window.__NEXT_DATA__`, inspect `players`, and see every opponent's cards.

**Fix**: Pass the requesting player's ID into `getGame` and filter hand data server-side so only `hand` for `thisPlayerId` is populated; return empty arrays for all other players. Alternatively, split into `getGameMeta(gameId)` (no hands) and `getMyHand(gameId)` (own hand only).

**Confidence**: Certain.

---

**C-5 `getGame()` called without an argument bypasses authorization**  
*Security/Bug · src/app/game/actions.ts:100–123*

When `gameIdToFetch` is `undefined`, the auth check is inside `if (gameIdToFetch)` and is silently skipped. The function then calls `findOrCreateGame()` and returns the first available game's full state (including all players' hands per C-4) to an unauthenticated caller.

```typescript
if (gameIdToFetch) {
  const authorizedPlayerId = await requireAuthOrDev(…);  // ← skipped when undefined
}
// ...
gameRow = await findOrCreateGame();  // runs for anyone
```

`SharedGameContext.createNewGame` and `refetchGameState` call `getGame()` with no argument.

**Fix**: Either require `gameIdToFetch` always and reject the call when absent, or create a separate unauthenticated `findOrCreatePublicLobby()` action that returns only non-sensitive fields (no hands, no player details beyond name/avatar).

**Confidence**: Certain.

---

### HIGH — Security

---

**H-1 `requireAuthOrDev` silently falls back to arbitrary player identity in dev mode**  
*Security · src/lib/gameAuth.ts:236–258*

When `NODE_ENV === 'development'` and the auth check fails (no cookie, wrong game, etc.), the fallback queries `players` and returns `.id` for the first player found in the game — no relationship to the actual caller. Every server action that uses `requireAuthOrDev` can then succeed as a random player.

This pattern will cause full auth bypass on any staging or CI environment that sets `NODE_ENV=development`.

**Fix**: Remove the fallback entirely. If integration tests need a player identity, use explicit test fixtures that set a real session cookie before each test, not a runtime bypass.

**Confidence**: Certain.

---

**H-2 Real Supabase credentials committed to repository**  
*Security · .env.test:5–7*

`.env.test` contains the live project's anon key AND service role key. The service role key bypasses all RLS and has full superuser access to the database. Anyone with repository read access (including contributors, CI runners, GitHub Actions logs) can access and fully compromise the database, even after RLS is enabled.

**Fix**: Rotate both keys immediately via the Supabase dashboard. Replace with placeholder comments in `.env.test`. Add `*.env*` or at minimum `.env.test` to `.gitignore`. Use CI secrets for actual test credentials.

**Confidence**: Certain.

---

**H-3 PIN guard is pure client-side; secret visible in the JS bundle**  
*Security · src/components/PinCodeModal.tsx:16, src/components/DevConsoleModal.tsx:33*

```typescript
const RESET_PIN = "6425";  // compiled into client bundle
```

The PIN is a compile-time constant in client-side TypeScript. Anyone can read it from the browser's Sources panel, the network response, or by searching the webpack bundle. The 500 ms delay is cosmetic. A determined user can also bypass the modal entirely and call `resetGameForTesting` directly.

**Fix**: Move PIN verification to a server action. The server action should compare against `process.env.ADMIN_PIN` (hashed, not plaintext). The client sends the PIN; the server validates and only then executes the operation.

**Confidence**: Certain.

---

**H-4 Dev console accessible in production via URL parameter**  
*Security · src/app/page.tsx:565, src/app/game/page.tsx:498*

```typescript
(process.env.NODE_ENV === 'development' ||
 (typeof window !== 'undefined' && window.location.search.includes('dev')))
```

Adding `?dev` anywhere in the URL exposes the dev console button in production. Combined with H-3 (PIN in bundle), anyone can access host management and reset functionality.

**Fix**: Remove the `?dev` escape hatch entirely. Use `NODE_ENV` alone for development access, or protect behind an environment variable checked server-side.

**Confidence**: Certain.

---

**H-5 `removePlayerFromGame` (voluntary) does not enforce self-removal**  
*Security · src/app/game/actions.ts:1390–1396*

For `reason === 'voluntary'`, the code verifies the caller is a game member but then only warns when they're removing someone else:

```typescript
if (authorizedPlayerId !== playerId) {
  console.warn(`🟡 …Player ${authorizedPlayerId} removing different player…`);
  // ← no throw, execution continues
}
```

Any authenticated game member can remove any other non-host player "voluntarily."

**Fix**: Replace the `console.warn` with `throw new Error('Unauthorized: can only remove yourself')`. The kicked path already has proper host verification.

**Confidence**: Certain.

---

**H-6 `transition_state` DB constraint diverges from production usage**  
*Security/Bug · database/migrations/002\_add\_transition\_state.sql:9–11*

Migration 002 defines:
```sql
CHECK (transition_state IN ('idle', 'starting_game', 'dealing_cards', 'ready'))
```

But `resetGameForTesting`, `removePlayerFromGame`, and the TypeScript `TransitionState` type all use `'resetting_game'`, which is not in this constraint. The `test-schema.sql` includes `'resetting_game'` in its constraint but that file is not applied to production. Any production `UPDATE games SET transition_state = 'resetting_game'` would fail with a constraint violation, silently breaking multi-player reset coordination.

**Fix**: Add a migration that updates the constraint to match `test-schema.sql`'s version, which also includes the missing states (`'selecting_scenario'`, `'processing_submissions'`, `'announcing_winner'`, `'next_round'`, `'game_ending'`, `'resetting_game'`).

**Confidence**: Certain about the constraint gap; needs live verification to confirm whether the migration was ever corrected outside the files tracked here (see NEEDS LIVE VERIFICATION).

---

### HIGH — Bugs

---

**H-7 `refetchGameState` has a stale closure — `thisPlayer` never updated after first load**  
*Bug · src/contexts/SharedGameContext.tsx:113–166*

`refetchGameState` is memoized with `useCallback(…, [])` (empty dependency array). Its body references `gameState` and `thisPlayer` from the outer scope. At every call, those values are the initial values at mount time (`null`). The comment "uses current gameState via closure" is incorrect — closures do not automatically capture mutable state; they capture the value at the time the callback was created.

In the real-time subscription handler (lines 263–284) and transition polling (lines 321–342), `thisPlayer` is updated only if `localStorage.getItem(`thisPlayerId_game_${gameId}`)` is non-null. Since the session migration removed all `localStorage.setItem` calls for that key, `storedPlayerId` will always be `null`, and `thisPlayer` will never update from subscription events. Players will see stale `isJudge` status and stale scores after real-time updates.

**Fix**: Use `useRef` to track the current player ID: `const thisPlayerIdRef = useRef<string|null>(null)` and update it in a `useEffect` when `thisPlayer` changes. Read from the ref inside the subscription handler instead of relying on localStorage or stale closure state.

**Confidence**: Certain about the stale closure; medium confidence about the observable behavior depending on whether `refetchGameState` is being called on a separate code path.

---

**H-8 Kicked players receive no notification and cannot self-remove**  
*Bug · src/app/game/page.tsx:262–280*

`handleKickedByHost` is defined but never called anywhere. When the host kicks a player via the DevConsole, the player's DB record is deleted. The victim receives a real-time update, `getGame` is called, they're absent from the player list, `thisPlayer` becomes `null`. With no explicit kick handler, the victim sees "Identifying player…" indefinitely (or the spectator view) with no explanation.

Additionally, `handleKickedByHost` itself calls `removePlayerFromGame(gameId, thisPlayer.id, 'kicked')` — but the player record has already been deleted by the host. This would throw "Player not found in game."

**Fix**: Detect the kicked state in the real-time subscription by comparing the previous player list to the new one. If `thisPlayer.id` was present before and absent after a DELETE event on `players`, navigate to `/?step=menu&exitReason=kicked` and show a toast. Do not call `removePlayerFromGame` from the victim's client.

**Confidence**: Certain.

---

**H-9 Host assignment race condition (TOCTOU)**  
*Bug · src/app/game/actions.ts:382–397*

After inserting a new player, `addPlayer` queries the total player count and conditionally sets the first player as host:

```typescript
const { data: allPlayers } = await supabase.from('players').select('id').eq('game_id', gameId);
const playerCount = allPlayers?.length || 0;
if (playerCount === 1 && !gameRow.created_by_player_id) {
  await supabase.from('games').update({ created_by_player_id: newPlayer.id })…
}
```

Two simultaneous joins can both observe `playerCount === 1` between the INSERT and the count query, both attempt `UPDATE games SET created_by_player_id = …`, and the last write wins. The first player gets their record inserted but may not become host, leaving the host field set to the second player.

**Fix**: Set `created_by_player_id` in the same INSERT that creates the game, or use a DB trigger: `CREATE OR REPLACE FUNCTION set_first_host() RETURNS TRIGGER … IF (SELECT count(*) FROM players WHERE game_id = NEW.game_id) = 1 THEN UPDATE games SET created_by_player_id = NEW.id WHERE id = NEW.game_id; END IF`. Alternatively, use `UPDATE games SET created_by_player_id = $1 WHERE id = $2 AND created_by_player_id IS NULL` as an atomic conditional set.

**Confidence**: Certain about the race condition; medium about observability in production given current concurrency levels.

---

**H-10 Score updates use read-modify-write instead of atomic increment**  
*Bug · src/app/game/actions.ts:1060, 1093, 1131*

```typescript
const { data: winnerPlayerData } = await supabase.from('players').select('score').eq('id', winningPlayerId).single();
const newScore = winnerPlayerData.score + 1;
await supabase.from('players').update({ score: newScore }).eq('id', winningPlayerId);
```

Under normal game conditions this is a single-writer operation, but in edge cases (Boondoggle path and standard path racing, or retry scenarios) a double increment is possible. Supabase supports atomic increments via PostgREST: `.update({ score: supabase.rpc('increment', { x: 1 }) })` or raw SQL `score = score + 1`.

**Fix**: Use `supabase.from('players').update({ score: knex.raw('score + 1') })` or a stored procedure, removing the read step.

**Confidence**: Medium — requires specific concurrency to trigger; present as a design issue regardless.

---

**H-11 1500 ms `await new Promise(setTimeout)` inside a server action**  
*Bug · src/app/game/actions.ts:477*

`resetGameForTesting` holds a Node.js HTTP request handler open for 1.5 seconds to give clients time to see the notification. On serverless deployments this increases invocation cost and risks timeout; on traditional deployments it holds a thread. This is a client UX concern that should not be solved by blocking the server.

**Fix**: Remove the server-side sleep. Clients already receive the `transition_state: 'resetting_game'` update via the real-time subscription and display the overlay for the `2000 ms` timeout configured in `SharedGameContext.tsx:174`. The server should complete the reset immediately after setting the transition state.

**Confidence**: Certain.

---

### MEDIUM — Architecture

---

**M-1 Single Supabase anon-key client used for all server operations**  
*Arch · src/lib/supabaseClient.ts*

`supabase` (anon key) is used for every server action write. Once RLS is added (C-2), writes from server actions will be blocked by the same policies that protect client access, requiring service-role bypasses for legitimate server operations. There is no `supabaseAdmin` / service-role client for server-side use.

**Fix**: Create `supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)` in a server-only module (never import in client code). Use it in server actions. Keep the anon client for client-side realtime subscriptions only.

---

**M-2 Realtime subscription listens to the entire `public` schema**  
*Arch · src/contexts/SharedGameContext.tsx:225–246*

```typescript
.on('postgres_changes', { event: '*', schema: 'public' }, …)
```

This subscribes to every table in the schema — including `response_cards`, `scenarios`, `winners`, and any future tables. Client-side filtering (`if (isRelevant)`) runs after the event is already delivered. Under load this creates unnecessary Realtime channel noise.

**Fix**: Use per-table subscriptions with server-side filters:
```typescript
.on('postgres_changes', { event: '*', schema: 'public', table: 'games',
    filter: `id=eq.${gameId}` }, handler)
.on('postgres_changes', { event: '*', schema: 'public', table: 'players',
    filter: `game_id=eq.${gameId}` }, handler)
```

---

**M-3 `nextRound` callable by any game member, not just judge/host**  
*Arch/Security · src/app/game/actions.ts:1148*

```typescript
const authorizedPlayerId = await requireAuthOrDev(gameId, () => requireGameMembership(gameId));
```

Any authenticated player can advance the round, not just the judge or host. A non-judge player could spam `nextRound` to skip judgment.

**Fix**: Change to `requireJudgeAccess` or `requireHostAccess`.

---

**M-4 `addPlayer` allows name-based impersonation / rejoin without cryptographic proof**  
*Arch/Security · src/app/game/actions.ts:330–354*

When a player with the same name already exists, `addPlayer` returns the existing player record. The caller then calls `setCurrentPlayerSession` with that player's ID. Since name is not a secret, any user who knows (or guesses) an existing player's name can claim their identity.

**Fix**: After finding the existing player by name, verify the caller has a pre-existing valid session for that player before returning it and re-issuing the cookie. Alternatively, return a distinct "name taken" error and require the user to choose a different name.

---

**M-5 `getCurrentPlayerId()` is always broken**  
*Bug/Arch · src/lib/gameAuth.ts:224–229*

```typescript
export async function getCurrentPlayerId(): Promise<string> {
  const tokenValidation = await validatePlayerAccess('');  // empty string
  …
}
```

Inside `validatePlayerAccess`:
```typescript
if (session.token.gameId !== requiredGameId) {  // UUID !== '' → always true
  return { authorized: false, error: 'Session is for different game' };
}
```

This function always throws. It is not called from any active code path currently, but its presence is misleading.

**Fix**: Either delete it, or pass a sentinel value (`null`) that `validatePlayerAccess` treats as "skip game ID check."

---

**M-6 `findOrCreateGame` returns in-progress games as fallback**  
*Bug/Arch · src/app/game/actions.ts:39–53*

If no lobby game exists, `findOrCreateGame` returns the oldest game regardless of phase. A new visitor calling `getGame()` (no arg, auth-bypassed per C-5) gets back a `judging`-phase game's full state, including player hands. Any subsequent `addPlayer` call against that game throws "Game is already in progress."

**Fix**: Either create a new game unconditionally when no lobby exists, or remove the second `select('*')` fallback query entirely.

---

**M-7 `isTransitioning` computed but unused in subscription effect**  
*Arch · src/contexts/SharedGameContext.tsx:189*

`const isTransitioning = gameState?.transitionState !== 'idle' && …` is computed but never referenced inside the `useEffect` body. It was likely intended to gate subscription setup but is currently dead code.

---

**M-8 Spectator detection still uses stale localStorage key**  
*Bug · src/app/page.tsx:483*

```typescript
} else if (!localStorage.getItem(`thisPlayerId_game_${internalGameState.gameId}`)) {
```

The auth migration removed all `localStorage.setItem` calls for this key. The key is never written. For non-lobby games, this branch always shows the spectator view — even to authenticated players who are members of the game.

**Fix**: Replace with a check against `thisPlayer` (from SharedGameContext), which is now populated from the JWT session: `} else if (!thisPlayer) {`.

---

### LOW

---

**L-1 TypeScript and ESLint errors silently ignored in builds**  
*Arch · next.config.ts:7, 11*

```typescript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

Type errors and lint warnings do not fail CI. This allows broken code to ship undetected.

---

**L-2 Verbose production logging leaks game state**  
*Arch · src/app/game/actions.ts (throughout)*

Every server action emits `console.log` with player IDs, game IDs, card selections, and round data. In hosted environments these logs may be forwarded to observability services or stored in plaintext. Reduce to warnings/errors only in production.

---

**L-3 Room code generation uses `Math.random()`**  
*Arch · src/lib/roomCodes.ts:22*

`Math.random()` is not cryptographically random. For room codes that gate entry to private games, use `crypto.getRandomValues()`:

```typescript
const buf = new Uint8Array(6);
crypto.getRandomValues(buf);
code = Array.from(buf).map(b => ROOM_CODE_CHARS[b % ROOM_CODE_CHARS.length]).join('');
```

---

**L-4 `handlePlayAgainYes` calls `resetGameForTesting()` without a game ID**  
*Bug · src/app/game/page.tsx:177*

This triggers the legacy "find first game" path in `resetGameForTesting`, which skips host auth and resets whichever game happens to be oldest. Should pass `internalGameState.gameId` explicitly.

---

**L-5 `allowedOrigins` wildcard is broad**  
*Arch · next.config.ts:18*

`'*.app.github.dev'` allows any GitHub Codespace subdomain to invoke server actions. Scope this to the specific Codespace in use, or remove when deploying outside Codespaces.

---

**L-6 `cleanupEmptyRooms` deletes games older than 10 minutes with no players**  
*Arch · src/app/game/actions.ts:560–632*

The 10-minute threshold could delete a game where the host created the room and stepped away briefly to share the link. There's no "created_by_player_id is still active" check.

---

## NEEDS LIVE VERIFICATION

The following items could not be confirmed from source files alone. Check these once the Supabase backend is restored.

| # | What to check | How to check |
|---|---|---|
| NLV-1 | Whether RLS is enabled on any table in production | Supabase Dashboard → Authentication → Policies; or `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` |
| NLV-2 | Whether any RLS policies exist that were added outside the tracked migration files | Same query above; list all policies |
| NLV-3 | Whether the `transition_state` CHECK constraint in production includes `'resetting_game'` (H-6) | `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'games'::regclass AND conname LIKE '%transition%'` |
| NLV-4 | Whether the service role key in `.env.test` has been rotated | Supabase Dashboard → Settings → API → Service Role key; compare suffix with the committed key |
| NLV-5 | Whether the anon key in `.env.example` / `.env.test` is still the live key | Same panel; compare suffix with `NEXT_PUBLIC_SUPABASE_ANON_KEY` in those files |
| NLV-6 | Whether `JWT_SECRET` is set in the production environment | Hosting platform env var settings; verify it is set, non-empty, and at least 32 characters |
| NLV-7 | Whether realtime is enabled for `player_hands` and `responses` tables | Supabase Dashboard → Database → Replication; confirm those tables are in the publication (or not, since they don't need realtime) |
| NLV-8 | Whether `games.created_by_player_id` FK ON DELETE behavior is set (test-schema.sql sets it to `ON DELETE SET NULL`; migration 001 does not) | `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'games'::regclass AND conname = 'games_created_by_player_id_fkey'` |

---

## Summary Table

| ID | Severity | Lens | Location | One-liner |
|----|----------|------|----------|-----------|
| C-1 | CRITICAL | Security | actions.ts:1362 | `setCurrentPlayerSession` issues JWT for any caller-supplied identity |
| C-2 | CRITICAL | Security | All migrations | No RLS on any table; anon key grants full DB access from the browser |
| C-3 | CRITICAL | Security | auth.ts:12 | JWT_SECRET falls back to hardcoded string if env var unset |
| C-4 | CRITICAL | Security | actions.ts:188–212 | `getGame` returns all opponents' card hands to every caller |
| C-5 | CRITICAL | Security/Bug | actions.ts:100–104 | `getGame()` without arg skips auth entirely |
| H-1 | HIGH | Security | gameAuth.ts:236 | `requireAuthOrDev` dev fallback returns arbitrary player identity |
| H-2 | HIGH | Security | .env.test:5–7 | Live anon key + service role key committed to repo |
| H-3 | HIGH | Security | PinCodeModal.tsx:16 | PIN `6425` compiled into client bundle; no server-side validation |
| H-4 | HIGH | Security | page.tsx:565, game/page.tsx:498 | Dev console reachable in production via `?dev` URL param |
| H-5 | HIGH | Security | actions.ts:1390 | Voluntary removal allows any member to remove any other player |
| H-6 | HIGH | Security/Bug | migrations/002 | `transition_state` DB constraint excludes production states like `'resetting_game'` |
| H-7 | HIGH | Bug | SharedGameContext.tsx:113 | `refetchGameState` stale closure; `thisPlayer` never updates from subscriptions |
| H-8 | HIGH | Bug | game/page.tsx:262 | Kicked players get no redirect — `handleKickedByHost` is never called |
| H-9 | HIGH | Bug | actions.ts:382 | TOCTOU race in host assignment on simultaneous joins |
| H-10 | HIGH | Bug | actions.ts:1060,1093 | Score increment is read-modify-write; double-increment possible |
| H-11 | HIGH | Bug | actions.ts:477 | 1500 ms blocking sleep inside server action |
| M-1 | MEDIUM | Arch | supabaseClient.ts | No service-role client; server actions use anon key |
| M-2 | MEDIUM | Arch | SharedGameContext.tsx:225 | Realtime subscribes to all tables in schema; no server-side filter |
| M-3 | MEDIUM | Arch/Security | actions.ts:1148 | `nextRound` callable by any game member, not just judge/host |
| M-4 | MEDIUM | Arch/Security | actions.ts:330 | Name-based rejoin allows identity takeover without cryptographic proof |
| M-5 | MEDIUM | Bug | gameAuth.ts:224 | `getCurrentPlayerId()` always throws due to empty-string gameId check |
| M-6 | MEDIUM | Bug | actions.ts:39 | `findOrCreateGame` falls through to in-progress games |
| M-7 | MEDIUM | Arch | SharedGameContext.tsx:189 | `isTransitioning` computed but never used in subscription effect |
| M-8 | MEDIUM | Bug | page.tsx:483 | Spectator check reads localStorage key that is never written |
| L-1 | LOW | Arch | next.config.ts:7,11 | TS + ESLint errors ignored in builds |
| L-2 | LOW | Arch | actions.ts (throughout) | Verbose `console.log` leaks game state in production logs |
| L-3 | LOW | Arch | roomCodes.ts:22 | `Math.random()` used for room code generation (not CSPRNG) |
| L-4 | LOW | Bug | game/page.tsx:177 | `handlePlayAgainYes` calls reset without game ID — skips host auth |
| L-5 | LOW | Arch | next.config.ts:18 | Broad `*.app.github.dev` in allowedOrigins |
| L-6 | LOW | Arch | actions.ts:560 | 10-min cleanup could delete rooms where host hasn't joined yet |
