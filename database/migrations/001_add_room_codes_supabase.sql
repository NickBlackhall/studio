-- Migration: Add room code support to games table (Supabase Compatible)
-- This enables multi-room functionality while maintaining backward compatibility
-- 
-- NOTE: This version is optimized for Supabase SQL Editor (removes CONCURRENTLY)

-- Add new columns to games table
ALTER TABLE games 
ADD COLUMN room_code VARCHAR(6) UNIQUE,
ADD COLUMN is_public BOOLEAN DEFAULT true,
ADD COLUMN max_players INTEGER DEFAULT 10,
ADD COLUMN room_name TEXT,
ADD COLUMN created_by_player_id UUID REFERENCES players(id);

-- Create indexes for performance (without CONCURRENTLY for Supabase compatibility)
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_public ON games(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_games_active ON games(game_phase) WHERE game_phase != 'game_over';

-- Add room code to existing games (backward compatibility)
-- Generate unique room codes for any existing games
DO $$
DECLARE
    game_record RECORD;
    new_room_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    FOR game_record IN SELECT id FROM games WHERE room_code IS NULL LOOP
        -- Generate a unique room code for existing games
        LOOP
            -- Generate 6-character alphanumeric code (excluding confusing chars)
            new_room_code := UPPER(
                SUBSTRING(
                    MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
                    FROM 1 FOR 6
                )
            );
            
            -- Replace confusing characters
            new_room_code := REPLACE(new_room_code, '0', 'Z');
            new_room_code := REPLACE(new_room_code, 'O', 'X');
            new_room_code := REPLACE(new_room_code, '1', 'Y');
            new_room_code := REPLACE(new_room_code, 'I', 'W');
            
            -- Check if code already exists
            SELECT EXISTS(SELECT 1 FROM games WHERE room_code = new_room_code) INTO code_exists;
            
            EXIT WHEN NOT code_exists;
        END LOOP;
        
        -- Update the game with the new room code
        UPDATE games 
        SET room_code = new_room_code,
            room_name = 'Legacy Game'
        WHERE id = game_record.id;
        
        RAISE NOTICE 'Assigned room code % to existing game %', new_room_code, game_record.id;
    END LOOP;
END $$;

-- Make room_code NOT NULL after populating existing records
ALTER TABLE games ALTER COLUMN room_code SET NOT NULL;

-- Add constraint to ensure room codes are valid format
ALTER TABLE games ADD CONSTRAINT games_room_code_format 
    CHECK (room_code ~ '^[A-Z2-9]{6}$');

-- Add constraint for max_players range
ALTER TABLE games ADD CONSTRAINT games_max_players_range 
    CHECK (max_players >= 2 AND max_players <= 20);

-- Create function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_unique_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 100;
BEGIN
    LOOP
        -- Generate 6-character code
        new_code := UPPER(
            SUBSTRING(
                MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT || attempt_count::TEXT) 
                FROM 1 FOR 6
            )
        );
        
        -- Replace confusing characters with safe alternatives
        new_code := REPLACE(new_code, '0', 'Z');
        new_code := REPLACE(new_code, 'O', 'X');
        new_code := REPLACE(new_code, '1', 'Y');
        new_code := REPLACE(new_code, 'I', 'W');
        
        -- Ensure only valid characters (A-Z, 2-9)
        new_code := REGEXP_REPLACE(new_code, '[^A-Z2-9]', 
            SUBSTRING('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' FROM (RANDOM() * 32 + 1)::INTEGER FOR 1), 
            'g'
        );
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM games WHERE room_code = new_code) INTO code_exists;
        
        -- Exit if unique code found
        EXIT WHEN NOT code_exists;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'Could not generate unique room code after % attempts', max_attempts;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create view for active public games (useful for room browser)
CREATE OR REPLACE VIEW public_games AS
SELECT 
    g.id,
    g.room_code,
    g.room_name,
    g.game_phase,
    g.max_players,
    g.created_at,
    COUNT(p.id) as current_players,
    g.max_players - COUNT(p.id) as available_slots
FROM games g
LEFT JOIN players p ON g.id = p.game_id
WHERE g.is_public = true 
  AND g.game_phase IN ('lobby', 'category_selection', 'player_submission', 'judging', 'winner_announcement')
GROUP BY g.id, g.room_code, g.room_name, g.game_phase, g.max_players, g.created_at
HAVING COUNT(p.id) < g.max_players
ORDER BY g.created_at DESC;

-- Add helpful comments
COMMENT ON COLUMN games.room_code IS 'Unique 6-character alphanumeric room code for joining games';
COMMENT ON COLUMN games.is_public IS 'Whether this game appears in public room browser';
COMMENT ON COLUMN games.max_players IS 'Maximum number of players allowed in this game';
COMMENT ON COLUMN games.room_name IS 'Optional custom name for the game room';
COMMENT ON COLUMN games.created_by_player_id IS 'Player who created this room (host)';

-- Migration complete - display success message
SELECT 'Multi-room migration completed successfully! 🎉' as status;

-- Show the room codes that were generated for existing games
SELECT 
    'Your existing games now have room codes:' as message,
    id,
    room_code,
    room_name,
    game_phase,
    created_at
FROM games 
ORDER BY created_at DESC;