-- Check if transition_state column exists and what values it has

-- 1. Check column properties
SELECT 
    'Column properties:' as test,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
  AND column_name = 'transition_state';

-- 2. Check current values in existing games
SELECT 
    'Current transition states:' as test,
    id,
    game_phase,
    transition_state,
    room_code,
    created_at
FROM games 
ORDER BY created_at DESC;

-- 3. Check if constraint exists
SELECT 
    'Constraints:' as test,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'games' 
  AND constraint_name LIKE '%transition_state%';

-- 4. Check if index exists
SELECT 
    'Indexes:' as test,
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename = 'games' 
  AND indexname LIKE '%transition_state%';

SELECT '✅ Database schema audit complete!' as final_message;