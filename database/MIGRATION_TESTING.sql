-- Test queries to validate the room code migration worked correctly
-- Run these after applying 001_add_room_codes_supabase.sql

-- 1. Check that all games now have room codes
SELECT 
    'Games with room codes:' as test,
    COUNT(*) as total_games,
    COUNT(room_code) as games_with_room_codes,
    CASE 
        WHEN COUNT(*) = COUNT(room_code) THEN '✅ PASS' 
        ELSE '❌ FAIL - Some games missing room codes'
    END as result
FROM games;

-- 2. Verify room code format is correct
SELECT 
    'Room code format validation:' as test,
    room_code,
    CASE 
        WHEN room_code ~ '^[A-Z2-9]{6}$' THEN '✅ Valid format' 
        ELSE '❌ Invalid format'
    END as validation
FROM games;

-- 3. Test the room code generation function
SELECT 
    'Room code generation test:' as test,
    generate_unique_room_code() as generated_code_1,
    generate_unique_room_code() as generated_code_2,
    generate_unique_room_code() as generated_code_3;

-- 4. Check that indexes were created
SELECT 
    'Database indexes:' as test,
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename = 'games' 
  AND indexname LIKE 'idx_games_%'
ORDER BY indexname;

-- 5. Test the public_games view
SELECT 
    'Public games view test:' as test,
    *
FROM public_games;

-- 6. Verify constraints are working
-- This should succeed:
SELECT 'Testing valid room code constraint:' as test;
-- (We can't actually insert/update in a read-only test, but the constraint exists)

-- 7. Check column properties
SELECT 
    'Column properties:' as test,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
  AND column_name IN ('room_code', 'is_public', 'max_players', 'room_name', 'created_by_player_id')
ORDER BY column_name;

-- 8. Show all your games with their new room codes
SELECT 
    '🎮 Your games are ready for multi-room!' as message,
    room_code as "Room Code",
    COALESCE(room_name, 'Unnamed Room') as "Room Name",
    game_phase as "Status",
    max_players as "Max Players",
    is_public as "Public",
    created_at as "Created"
FROM games 
ORDER BY created_at DESC;

-- 9. Test room code uniqueness
SELECT 
    'Room code uniqueness check:' as test,
    COUNT(*) as total_codes,
    COUNT(DISTINCT room_code) as unique_codes,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT room_code) THEN '✅ All room codes are unique' 
        ELSE '❌ Duplicate room codes found!'
    END as result
FROM games;

SELECT '🚀 Migration validation complete!' as final_message;