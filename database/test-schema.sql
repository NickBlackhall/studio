-- Complete Database Schema for E2E Testing
-- This file creates all tables and seed data needed for comprehensive E2E tests
-- For use with Playwright tests and CI/CD environments

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- CORE GAME TABLES
-- =====================================================================

-- Games table - Core game state and room management
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    game_phase TEXT NOT NULL DEFAULT 'lobby',
    current_round INTEGER DEFAULT 0,
    current_judge_id UUID,
    current_scenario_id UUID,
    ready_player_order UUID[],
    last_round_winner_player_id UUID,
    last_round_winning_card_text TEXT,
    overall_winner_player_id UUID,
    used_scenarios UUID[] DEFAULT '{}',
    used_responses UUID[] DEFAULT '{}',
    transition_state TEXT DEFAULT 'idle',
    transition_message TEXT,
    room_code VARCHAR(6) NOT NULL UNIQUE,
    is_public BOOLEAN DEFAULT true,
    max_players INTEGER DEFAULT 10,
    room_name TEXT,
    created_by_player_id UUID
);

-- Players table - Player data and game participation
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    game_id UUID NOT NULL,
    is_judge BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    avatar TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    is_ready BOOLEAN DEFAULT false
);

-- Scenarios table - Game prompts/situations
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    text TEXT NOT NULL,
    category TEXT NOT NULL
);

-- Response cards table - Available response options
CREATE TABLE IF NOT EXISTS response_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    author_player_id UUID,
    author_name TEXT
);

-- Player hands table - Cards currently in each player's hand
CREATE TABLE IF NOT EXISTS player_hands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    player_id UUID NOT NULL,
    game_id UUID NOT NULL,
    response_card_id UUID NOT NULL,
    is_new BOOLEAN DEFAULT false
);

-- Responses table - Player submissions for each round
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    player_id UUID NOT NULL,
    response_card_id UUID,
    submitted_text TEXT,
    game_id UUID NOT NULL,
    round_number INTEGER NOT NULL
);

-- Winners table - Historical round winners
CREATE TABLE IF NOT EXISTS winners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    game_id UUID NOT NULL,
    round_number INTEGER NOT NULL,
    winner_player_id UUID NOT NULL,
    winning_response_card_id UUID NOT NULL
);

-- =====================================================================
-- CONSTRAINTS AND FOREIGN KEYS
-- =====================================================================

-- Games constraints
ALTER TABLE games ADD CONSTRAINT games_room_code_format 
    CHECK (room_code ~ '^[A-Z2-9]{6}$');
ALTER TABLE games ADD CONSTRAINT games_max_players_range 
    CHECK (max_players >= 2 AND max_players <= 20);
ALTER TABLE games ADD CONSTRAINT games_transition_state_check 
    CHECK (transition_state IN ('idle', 'starting_game', 'dealing_cards', 'ready', 'resetting_game'));

-- Foreign key constraints
ALTER TABLE games ADD CONSTRAINT games_current_judge_id_fkey 
    FOREIGN KEY (current_judge_id) REFERENCES players(id);
ALTER TABLE games ADD CONSTRAINT games_current_scenario_id_fkey 
    FOREIGN KEY (current_scenario_id) REFERENCES scenarios(id);
ALTER TABLE games ADD CONSTRAINT games_last_round_winner_player_id_fkey 
    FOREIGN KEY (last_round_winner_player_id) REFERENCES players(id);
ALTER TABLE games ADD CONSTRAINT games_overall_winner_player_id_fkey 
    FOREIGN KEY (overall_winner_player_id) REFERENCES players(id);
ALTER TABLE games ADD CONSTRAINT games_created_by_player_id_fkey 
    FOREIGN KEY (created_by_player_id) REFERENCES players(id);

ALTER TABLE players ADD CONSTRAINT players_game_id_fkey 
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

ALTER TABLE response_cards ADD CONSTRAINT fk_response_cards_author_player 
    FOREIGN KEY (author_player_id) REFERENCES players(id);

ALTER TABLE player_hands ADD CONSTRAINT player_hands_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE player_hands ADD CONSTRAINT player_hands_game_id_fkey 
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE player_hands ADD CONSTRAINT player_hands_response_card_id_fkey 
    FOREIGN KEY (response_card_id) REFERENCES response_cards(id);

ALTER TABLE responses ADD CONSTRAINT responses_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE responses ADD CONSTRAINT responses_game_id_fkey 
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE responses ADD CONSTRAINT responses_response_card_id_fkey 
    FOREIGN KEY (response_card_id) REFERENCES response_cards(id);

ALTER TABLE winners ADD CONSTRAINT winners_game_id_fkey 
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE winners ADD CONSTRAINT winners_winner_player_id_fkey 
    FOREIGN KEY (winner_player_id) REFERENCES players(id);
ALTER TABLE winners ADD CONSTRAINT winners_winning_response_card_id_fkey 
    FOREIGN KEY (winning_response_card_id) REFERENCES response_cards(id);

-- =====================================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_public ON games(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_games_active ON games(game_phase) WHERE game_phase != 'game_over';
CREATE INDEX IF NOT EXISTS idx_games_transition_state ON games(transition_state);

CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_ready ON players(is_ready) WHERE is_ready = true;

CREATE INDEX IF NOT EXISTS idx_scenarios_category ON scenarios(category);
CREATE INDEX IF NOT EXISTS idx_response_cards_active ON response_cards(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_player_hands_player_game ON player_hands(player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_responses_game_round ON responses(game_id, round_number);
CREATE INDEX IF NOT EXISTS idx_winners_game_id ON winners(game_id);

-- =====================================================================
-- UTILITY FUNCTIONS
-- =====================================================================

-- Function to generate unique room codes
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

-- View for active public games (useful for room browser)
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

-- =====================================================================
-- TEST SEED DATA
-- =====================================================================

-- Insert test scenarios
INSERT INTO scenarios (text, category) VALUES 
('You need to explain social media to your grandparents. How do you make it sound as confusing as possible?', 'Awkward Family Moments'),
('You''re trying to return something without a receipt. What''s your ridiculous excuse?', 'Retail Nightmares'), 
('You''re stuck in an elevator with your worst enemy. What do you talk about?', 'Uncomfortable Situations'),
('You have to give a presentation but forgot to prepare. What''s your opening line?', 'Work Disasters'),
('You''re on a first date and they order the most expensive thing on the menu. What do you do?', 'Dating Fails'),
('You''re at a wedding and the bride asks you to give an impromptu speech. What do you say?', 'Social Disasters'),
('You wake up and realize you''re at the wrong house party. How do you handle it?', 'Party Problems'),
('You''re babysitting and the kids ask where babies come from. How do you answer?', 'Awkward Conversations'),
('You''re in a meeting and realize you''re on mute during your entire presentation. What''s your recovery?', 'Technology Fails'),
('You''re at the grocery store and your card gets declined. What''s your next move?', 'Everyday Embarrassments')
ON CONFLICT DO NOTHING;

-- Insert test response cards (a good variety for testing)
INSERT INTO response_cards (text) VALUES 
('With a confused look and lots of hand gestures'),
('By pretending to be a foreign exchange student'),
('While crying uncontrollably'),
('Using only song lyrics from the 90s'),
('With interpretive dance'),
('By blaming it on Mercury being in retrograde'),
('While maintaining unbroken eye contact'),
('Using a fake accent'),
('By making it someone else''s problem'),
('With the confidence of a toddler who just learned to walk'),
('By dramatically fainting'),
('Using only quotes from The Office'),
('While secretly texting for help'),
('By turning it into a conspiracy theory'),
('With the enthusiasm of a golden retriever'),
('By pretending it''s all part of my master plan'),
('Using interpretive mime'),
('While slowly backing toward the exit'),
('By bringing up an unrelated childhood trauma'),
('With the grace of a drunk giraffe'),
('By making it about politics somehow'),
('Using only questions as answers'),
('While stress-eating'),
('By channeling my inner Karen'),
('With the subtlety of a brick through a window'),
('By immediately changing the subject to cats'),
('Using finger guns and winking'),
('While pretending to have WiFi issues'),
('By making it weirdly philosophical'),
('With aggressive passive-aggressiveness'),
('By suddenly developing a mysterious illness'),
('Using only words that rhyme'),
('While practicing social distancing'),
('By turning it into a TikTok trend'),
('With the energy of a caffeinated squirrel')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- TEST CLEANUP FUNCTIONS
-- =====================================================================

-- Function to clean up test data (for test isolation)
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS VOID AS $$
BEGIN
    -- Delete all data in reverse dependency order
    DELETE FROM winners;
    DELETE FROM responses;
    DELETE FROM player_hands;
    DELETE FROM players;
    DELETE FROM games WHERE room_code LIKE 'TEST%';
    
    -- Note: We keep scenarios and response_cards as they're seed data
END;
$$ LANGUAGE plpgsql;

-- Function to create a test game with specified room code
CREATE OR REPLACE FUNCTION create_test_game(test_room_code VARCHAR(6))
RETURNS UUID AS $$
DECLARE
    game_id UUID;
BEGIN
    INSERT INTO games (room_code, room_name, game_phase, is_public, max_players)
    VALUES (test_room_code, 'Test Game', 'lobby', true, 8)
    RETURNING id INTO game_id;
    
    RETURN game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create smoke test table for deterministic Realtime testing
CREATE OR REPLACE FUNCTION create_smoke_test_table()
RETURNS VOID AS $$
BEGIN
    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS rt_smoke (
        id SERIAL PRIMARY KEY,
        test_value TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Configure for Realtime
    ALTER TABLE rt_smoke REPLICA IDENTITY FULL;
    
    -- Ensure it's in the publication
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE rt_smoke;
        EXCEPTION
            WHEN duplicate_object THEN NULL; -- Table already in publication
        END;
    END IF;
    
    -- Clean up old test data
    DELETE FROM rt_smoke WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================================

COMMENT ON TABLE games IS 'Core game state and room management';
COMMENT ON COLUMN games.room_code IS 'Unique 6-character alphanumeric room code for joining games';
COMMENT ON COLUMN games.is_public IS 'Whether this game appears in public room browser';
COMMENT ON COLUMN games.max_players IS 'Maximum number of players allowed in this game';
COMMENT ON COLUMN games.room_name IS 'Optional custom name for the game room';
COMMENT ON COLUMN games.created_by_player_id IS 'Player who created this room (host)';
COMMENT ON COLUMN games.transition_state IS 'Controls real-time subscriptions during transitions: idle (normal), starting_game, dealing_cards, ready, resetting_game';

COMMENT ON TABLE players IS 'Player data and game participation';
COMMENT ON TABLE scenarios IS 'Game prompts and situations for players to respond to';
COMMENT ON TABLE response_cards IS 'Available response options for players';
COMMENT ON TABLE player_hands IS 'Cards currently in each player''s hand';
COMMENT ON TABLE responses IS 'Player submissions for each round';
COMMENT ON TABLE winners IS 'Historical record of round winners';

-- =====================================================================
-- REALTIME CONFIGURATION (Critical for subscription tests)
-- =====================================================================

-- Ensure complete payloads for UPDATE/DELETE
ALTER TABLE public.games   REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;

-- Ensure publication exists and includes our tables
DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END$;

-- If local publication is not FOR ALL TABLES, explicitly include targets:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.games, public.players;

-- FK: make cleanup easy and robust
DO $
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.games'::regclass
    AND confrelid = 'public.players'::regclass
    AND conname LIKE '%current_judge_id%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.games DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE public.games
    ADD CONSTRAINT games_current_judge_id_fkey
    FOREIGN KEY (current_judge_id) REFERENCES public.players(id)
    ON DELETE SET NULL;
END$;

-- Final success message
SELECT 'E2E Test Database Schema Setup Complete! 🎉' as status,
       'Tables created with seed data, utility functions, and realtime configuration' as details,
       (SELECT COUNT(*) FROM scenarios) as scenarios_count,
       (SELECT COUNT(*) FROM response_cards) as response_cards_count;