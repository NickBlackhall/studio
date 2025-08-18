// Note: testSupabase client now imported from './testSupabase' 
// This maintains backward compatibility for existing imports
import { testSupabase } from './testSupabase';

// Re-export for backward compatibility
export { testSupabase };

// Test data prefixes for safe isolation
export const TEST_PREFIX = 'test_';
export const TEST_GAME_PREFIX = `${TEST_PREFIX}game_`;
export const TEST_PLAYER_PREFIX = `${TEST_PREFIX}player_`;

/**
 * Generate unique test IDs with timestamp to avoid conflicts
 */
export function generateTestId(prefix: string = TEST_PREFIX): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}${timestamp}_${random}`;
}

/**
 * Generate valid room code following database constraint: ^[A-Z2-9]{6}$
 */
export function generateTestRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0,1,I,O
  let result = 'T'; // Start with T for Test
  for (let i = 1; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Setup test database - prepare for integration tests
 */
export async function setupTestDatabase(): Promise<void> {
  console.log('🧪 Setting up test database...');
  
  // Verify connection
  const { data, error } = await testSupabase
    .from('games')
    .select('count')
    .limit(1);
    
  if (error) {
    throw new Error(`Failed to connect to test database: ${error.message}`);
  }
  
  console.log('✅ Test database connection verified');
}

/**
 * Clean up all test data - run after each test or test suite
 */
export async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Clean up test players first (foreign key constraint)
    const { error: playersError } = await testSupabase
      .from('players')
      .delete()
      .like('name', `${TEST_PREFIX}%`);
      
    if (playersError && !playersError.message.includes('No rows deleted')) {
      console.warn('Warning cleaning test players:', playersError.message);
    }
    
    // Clean up test games (look for games with room codes starting with T)
    const { error: gamesError } = await testSupabase
      .from('games')
      .delete()
      .like('room_code', 'T%');
      
    if (gamesError && !gamesError.message.includes('No rows deleted')) {
      console.warn('Warning cleaning test games:', gamesError.message);
    }
    
    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
    // Don't throw - cleanup failures shouldn't break tests
  }
}

/**
 * Create a test game with safe test data
 */
export async function createTestGame(overrides: any = {}) {
  const testRoomCode = generateTestRoomCode();
  
  const gameData = {
    // Let Supabase generate UUID for id
    room_code: testRoomCode,
    game_phase: 'lobby',
    current_round: 1,
    current_judge_id: null,
    current_scenario_id: null,
    ready_player_order: [],
    last_round_winner_player_id: null,
    last_round_winning_card_text: null,
    overall_winner_player_id: null,
    used_scenarios: [],
    used_responses: [],
    transition_state: 'idle',
    transition_message: null,
    is_public: false, // Keep test games private
    max_players: 10,
    room_name: `${TEST_PREFIX}TestRoom`,
    created_by_player_id: null,
    ...overrides
  };
  
  const { data, error } = await testSupabase
    .from('games')
    .insert(gameData)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create test game: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a test player with safe test data
 */
export async function createTestPlayer(gameId: string, overrides: any = {}) {
  const playerData = {
    // Let Supabase generate UUID for id
    game_id: gameId,
    name: `${TEST_PREFIX}Player_${Date.now()}`,
    avatar: '🧪',
    score: 0,
    is_judge: false,
    is_ready: false,
    ...overrides
  };
  
  const { data, error } = await testSupabase
    .from('players')
    .insert(playerData)
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create test player: ${error.message}`);
  }
  
  return data;
}

/**
 * Get all test games (for debugging/verification)
 */
export async function getTestGames() {
  const { data, error } = await testSupabase
    .from('games')
    .select('*')
    .like('room_code', `${TEST_PREFIX}%`);
    
  return { data: data || [], error };
}

/**
 * Get all test players (for debugging/verification)
 */
export async function getTestPlayers() {
  const { data, error } = await testSupabase
    .from('players')
    .select('*')
    .like('name', `${TEST_PREFIX}%`);
    
  return { data: data || [], error };
}

/**
 * Verify test isolation - ensure no test data leaks into real data
 */
export async function verifyTestIsolation(): Promise<boolean> {
  const { data: testGames } = await getTestGames();
  const { data: testPlayers } = await getTestPlayers();
  
  const hasTestData = (testGames && testGames.length > 0) || (testPlayers && testPlayers.length > 0);
  
  if (hasTestData) {
    console.warn('⚠️ Test data found in database - cleanup may be needed');
    console.log('Test games:', testGames?.length || 0);
    console.log('Test players:', testPlayers?.length || 0);
  }
  
  return !hasTestData;
}