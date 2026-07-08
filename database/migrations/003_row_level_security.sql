-- ============================================================================
-- Migration 003: Row Level Security for Make It Terrible
-- ============================================================================
--
-- CONTEXT / THREAT MODEL
-- ----------------------
-- This app uses the Supabase ANON key in two places:
--   1. The browser (for realtime subscriptions)
--   2. Next.js server actions (all game writes)
--
-- All authorization (membership / judge / host) is enforced in the Next.js
-- server-action layer via JWT session cookies (src/lib/gameAuth.ts). But the
-- anon key is PUBLIC — anyone can copy it from the page source and hit
-- PostgREST directly, bypassing every server-action check.
--
-- Because server actions share the same anon key, RLS here cannot distinguish
-- "our server" from "a random script kiddie" — that requires moving server
-- actions to the SERVICE ROLE key (see Phase 2 note at the bottom). What this
-- migration DOES accomplish today, without breaking the app:
--
--   * Blocks direct-DB destruction: deletes of games/players/cards by
--     anyone with the anon key are denied except where the app needs them.
--   * Blocks tampering with the content library (scenarios are read-only;
--     response_cards can only be INSERTed — the custom-card feature — never
--     updated or deleted).
--   * Keeps gameplay tables writable enough that the current server actions
--     continue to work unchanged.
--
-- HOW TO APPLY: run in the Supabase SQL Editor, or via MCP apply_migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table
-- ---------------------------------------------------------------------------
ALTER TABLE games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_hands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners        ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies so this migration is idempotent
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('games','players','scenarios','response_cards',
                        'player_hands','responses','winners')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. games — readable (room browser / realtime), writable for game flow,
--    deletable only when empty (matches cleanupEmptyRooms behavior)
-- ---------------------------------------------------------------------------
CREATE POLICY games_select ON games
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY games_insert ON games
  FOR INSERT TO anon, authenticated WITH CHECK (game_phase = 'lobby');

CREATE POLICY games_update ON games
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Only allow deleting games that have no players (empty-room cleanup).
CREATE POLICY games_delete_empty_only ON games
  FOR DELETE TO anon, authenticated
  USING (NOT EXISTS (SELECT 1 FROM players p WHERE p.game_id = games.id));

-- ---------------------------------------------------------------------------
-- 3. players — readable, insertable only into lobby-phase games that are not
--    full, updatable, deletable (player removal / kicks)
-- ---------------------------------------------------------------------------
CREATE POLICY players_select ON players
  FOR SELECT TO anon, authenticated USING (true);

-- DB-level enforcement of "lobby only" and "not over max_players".
-- This backs up the server-side checks in addPlayer() against races and
-- direct PostgREST calls.
CREATE POLICY players_insert_lobby_not_full ON players
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = players.game_id
        AND g.game_phase = 'lobby'
        AND (SELECT count(*) FROM players p2 WHERE p2.game_id = g.id) < COALESCE(g.max_players, 8)
    )
  );

CREATE POLICY players_update ON players
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY players_delete ON players
  FOR DELETE TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. scenarios — READ ONLY. The scenario library is content, not game state.
-- ---------------------------------------------------------------------------
CREATE POLICY scenarios_select ON scenarios
  FOR SELECT TO anon, authenticated USING (true);
-- (no INSERT/UPDATE/DELETE policies => all writes denied)

-- ---------------------------------------------------------------------------
-- 5. response_cards — readable; INSERT allowed (judge-approved custom cards);
--    UPDATE/DELETE denied so the deck can't be defaced or wiped.
-- ---------------------------------------------------------------------------
CREATE POLICY response_cards_select ON response_cards
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY response_cards_insert ON response_cards
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_active = true AND length(btrim(text)) BETWEEN 1 AND 300);
-- (no UPDATE/DELETE policies => denied)

-- ---------------------------------------------------------------------------
-- 6. player_hands / responses / winners — per-game gameplay data.
--    Writes must reference a real game. Deletes allowed (reset / cleanup).
-- ---------------------------------------------------------------------------
CREATE POLICY player_hands_select ON player_hands
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY player_hands_insert ON player_hands
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM games g WHERE g.id = player_hands.game_id));
CREATE POLICY player_hands_update ON player_hands
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY player_hands_delete ON player_hands
  FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY responses_select ON responses
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY responses_insert ON responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM games g WHERE g.id = responses.game_id));
CREATE POLICY responses_delete ON responses
  FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY winners_select ON winners
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY winners_insert ON winners
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM games g WHERE g.id = winners.game_id));
CREATE POLICY winners_delete ON winners
  FOR DELETE TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 7. Realtime publication — make sure the tables the client listens to
--    actually broadcast changes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE games;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE players;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE responses;    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE player_hands; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE winners;      EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- DELETE payloads need the old row; give the tables full replica identity
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE player_hands REPLICA IDENTITY FULL;
ALTER TABLE responses REPLICA IDENTITY FULL;

-- ============================================================================
-- PHASE 2 (recommended, not included here because it requires a code change):
-- Move all server actions to a server-only SUPABASE_SERVICE_ROLE_KEY client,
-- then tighten these policies so the anon role is SELECT-only on everything.
-- At that point the JWT session layer becomes the sole write path and the
-- public anon key can do zero damage. See the audit report for details.
-- ============================================================================
