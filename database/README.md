# Database Migrations for Multi-Room Support

This directory contains SQL migration scripts to add multi-room functionality to Make It Terrible.

## Migration 001: Room Codes

**File**: `001_add_room_codes.sql`
**Purpose**: Add room code support to enable multiple concurrent games

### What This Migration Does

1. **Adds new columns to `games` table**:
   - `room_code`: 6-character unique identifier (e.g., "PARTY7")
   - `is_public`: Whether game appears in public room browser
   - `max_players`: Maximum players allowed (2-20, default 10)
   - `room_name`: Optional custom name for the room
   - `created_by_player_id`: Player who created the room (host)

2. **Creates performance indexes**:
   - Fast lookups by room code
   - Efficient public game queries
   - Active game filtering

3. **Backward compatibility**:
   - Generates room codes for existing games
   - Maintains current functionality during transition

4. **Helper functions**:
   - `generate_unique_room_code()`: Creates collision-free room codes
   - `public_games` view: Ready-to-use query for room browser

### Room Code Format

- **Length**: 6 characters
- **Characters**: A-Z, 2-9 (excludes confusing 0, O, 1, I)
- **Example**: `PARTY7`, `FUN23X`, `GAME42`
- **Uniqueness**: Guaranteed unique across all games

### How to Apply Migration

**Recommended: Use the Supabase-compatible version**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor  
3. Copy and paste the contents of `001_add_room_codes_supabase.sql` (NOT the original file)
4. Run the migration
5. You should see success messages and your existing games with new room codes!

**Why use the Supabase version?**
- The original `001_add_room_codes.sql` has `CREATE INDEX CONCURRENTLY` which fails in Supabase's transaction-wrapped SQL Editor
- The `_supabase.sql` version removes `CONCURRENTLY` but is otherwise identical
- Both versions are functionally equivalent - the Supabase version just works better with their SQL Editor

**Testing the Migration**
After running the migration, you can validate it worked by running the queries in `MIGRATION_TESTING.sql`

### Testing the Migration

After running the migration, you can test it:

```sql
-- Check that room codes were added to existing games
SELECT id, room_code, room_name, is_public, max_players FROM games;

-- Test room code generation function
SELECT generate_unique_room_code();

-- View public games
SELECT * FROM public_games;

-- Verify constraints work
-- This should fail:
INSERT INTO games (game_phase, room_code) VALUES ('lobby', 'INVALID!');
```

### Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove new columns (WARNING: This will lose room code data!)
ALTER TABLE games 
    DROP COLUMN room_code,
    DROP COLUMN is_public,
    DROP COLUMN max_players,
    DROP COLUMN room_name,
    DROP COLUMN created_by_player_id;

-- Drop indexes
DROP INDEX IF EXISTS idx_games_room_code;
DROP INDEX IF EXISTS idx_games_public;
DROP INDEX IF EXISTS idx_games_active;

-- Drop function and view
DROP FUNCTION IF EXISTS generate_unique_room_code();
DROP VIEW IF EXISTS public_games;
```

### Post-Migration Steps

After applying this migration:

1. **Update TypeScript types** ✅ (already done in `database.types.ts`)
2. **Update application code** to use room codes instead of hardcoded game IDs
3. **Add room creation/joining UI** 
4. **Test with multiple concurrent games**

### Migration Status

- ✅ SQL migration created
- ✅ TypeScript types updated  
- ✅ Room code utilities created
- ⏳ Application code updates (next step)
- ⏳ UI updates for room creation/joining
- ⏳ Testing and validation

### Notes

- Migration is designed to be **safe** and **backward compatible**
- Existing games will continue to work normally
- Room codes are generated automatically for existing games
- All constraints and indexes are added for performance and data integrity
- The migration includes extensive error handling and validation