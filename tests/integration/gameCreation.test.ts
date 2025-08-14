import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  generateTestId,
  generateTestRoomCode,
  TEST_PREFIX
} from '../helpers/testDatabase';

describe('Integration - Game Creation', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('creates a game in the database', async () => {
    const game = await createTestGame({
      game_phase: 'lobby'
    });

    expect(game.id).toBeDefined();
    expect(game.room_code).toMatch(/^T[A-Z2-9]{5}$/);
    expect(game.game_phase).toBe('lobby');
    expect(game.current_round).toBe(1);
    expect(game.is_public).toBe(false);
    expect(game.max_players).toBe(10);
    expect(game.transition_state).toBe('idle');
  });

  test('retrieves game from database', async () => {
    const createdGame = await createTestGame();
    
    const { data: retrievedGame, error } = await testSupabase
      .from('games')
      .select('*')
      .eq('id', createdGame.id)
      .single();

    expect(error).toBeNull();
    expect(retrievedGame).toBeDefined();
    expect(retrievedGame.id).toBe(createdGame.id);
    expect(retrievedGame.room_code).toBe(createdGame.room_code);
  });

  test('updates game phase in database', async () => {
    const game = await createTestGame({
      game_phase: 'lobby'
    });

    const { error } = await testSupabase
      .from('games')
      .update({ game_phase: 'category_selection' })
      .eq('id', game.id);

    expect(error).toBeNull();

    // Verify update
    const { data: updatedGame } = await testSupabase
      .from('games')
      .select('game_phase')
      .eq('id', game.id)
      .single();

    expect(updatedGame.game_phase).toBe('category_selection');
  });

  test('creates game with multiple players', async () => {
    const game = await createTestGame();
    
    const player1 = await createTestPlayer(game.id, {
      name: `${TEST_PREFIX}Player1`,
      is_ready: true
    });
    
    const player2 = await createTestPlayer(game.id, {
      name: `${TEST_PREFIX}Player2`,
      is_ready: false
    });

    // Verify players were created
    const { data: players, error } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);

    expect(error).toBeNull();
    expect(players).toHaveLength(2);
    expect(players.find(p => p.id === player1.id)?.is_ready).toBe(true);
    expect(players.find(p => p.id === player2.id)?.is_ready).toBe(false);
  });

  test('handles game creation errors gracefully', async () => {
    // Try to create game with missing required field
    const { error } = await testSupabase
      .from('games')
      .insert({
        // Missing required fields intentionally
        room_code: null
      });

    expect(error).toBeDefined();
    expect(error.message).toContain('null value');
  });

  test('enforces unique room codes', async () => {
    const roomCode = generateTestRoomCode();
    
    // Create first game
    await createTestGame({ room_code: roomCode });
    
    // Try to create second game with same room code
    const { error } = await testSupabase
      .from('games')
      .insert({
        // Let Supabase generate UUID
        room_code: roomCode, // Duplicate room code
        game_phase: 'lobby',
        current_round: 1,
        ready_player_order: [],
        transition_state: 'idle'
      });

    expect(error).toBeDefined();
    expect(error.message).toContain('duplicate');
  });

  test('validates game data constraints', async () => {
    const game = await createTestGame({
      current_round: 5,
      max_players: 8,
      room_name: `${TEST_PREFIX}CustomRoom`
    });

    expect(game.current_round).toBe(5);
    expect(game.max_players).toBe(8);
    expect(game.room_name).toBe(`${TEST_PREFIX}CustomRoom`);
    expect(game.ready_player_order).toEqual([]);
    expect(game.used_scenarios).toEqual([]);
  });

  test('deletes game after removing players', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id);

    // Verify player exists
    const { data: playersBefore } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersBefore).toHaveLength(1);

    // Delete players first (foreign key constraint)
    const { error: playersError } = await testSupabase
      .from('players')
      .delete()
      .eq('game_id', game.id);
    expect(playersError).toBeNull();

    // Then delete game
    const { error: gameError } = await testSupabase
      .from('games')
      .delete()
      .eq('id', game.id);
    expect(gameError).toBeNull();

    // Verify both are deleted
    const { data: playersAfter } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersAfter).toHaveLength(0);

    const { data: gamesAfter } = await testSupabase
      .from('games')
      .select('*')
      .eq('id', game.id);
    expect(gamesAfter).toHaveLength(0);
  });
});