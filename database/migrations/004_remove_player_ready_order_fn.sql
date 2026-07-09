-- Migration 004: atomic ready_player_order removal
--
-- removePlayerFromGame previously read ready_player_order, filtered the
-- leaving player out in JS, and wrote the array back. Two players leaving
-- at the same time each wrote back their own stale copy, so one removal
-- was silently undone and a departed player stayed in the ready order.
-- array_remove() inside a single UPDATE is atomic.
--
-- HOW TO APPLY: run in the Supabase SQL Editor, or via MCP apply_migration.

CREATE OR REPLACE FUNCTION remove_player_from_ready_order(p_game_id UUID, p_player_id UUID)
RETURNS VOID AS $$
  UPDATE games
  SET ready_player_order = array_remove(ready_player_order, p_player_id),
      updated_at = NOW()
  WHERE id = p_game_id;
$$ LANGUAGE sql;
