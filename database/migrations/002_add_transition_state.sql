-- Migration: Add transition_state column for smooth lobby-to-game transitions
-- This enables controlled transitions by disabling real-time updates during server operations

-- Add transition_state column to games table
ALTER TABLE games 
ADD COLUMN transition_state TEXT DEFAULT 'idle';

-- Add constraint to ensure valid transition states
ALTER TABLE games 
ADD CONSTRAINT games_transition_state_check 
CHECK (transition_state IN ('idle', 'starting_game', 'dealing_cards', 'ready'));

-- Add index for performance (queries will filter on this frequently)
CREATE INDEX IF NOT EXISTS idx_games_transition_state ON games(transition_state);

-- Add helpful comment
COMMENT ON COLUMN games.transition_state IS 'Controls real-time subscriptions during transitions: idle (normal), starting_game, dealing_cards, ready';

-- Show current games with their new transition state
SELECT 
    'Transition state column added successfully! 🎉' as status,
    id,
    game_phase,
    transition_state,
    room_code
FROM games 
ORDER BY created_at DESC;