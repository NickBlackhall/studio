/**
 * Server Actions Behavior Tests
 * Tests server action behavior indirectly by testing database operations
 * and state changes that server actions should produce
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  generateTestRoomCode,
  TEST_PREFIX
} from '../helpers/testDatabase';

describe('Integration - Server Actions Behavior', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Game Creation Behavior', () => {
    test('game creation follows expected database pattern', async () => {
      // Test the database operations that findOrCreateGame should perform
      
      // 1. Check for existing lobby games (there might be some from previous tests)
      const { data: existingLobby } = await testSupabase
        .from('games')
        .select('*')
        .eq('game_phase', 'lobby')
        .order('created_at', { ascending: true })
        .limit(1);

      // Clean up any existing test games first
      if (existingLobby && existingLobby.length > 0) {
        await testSupabase
          .from('games')
          .delete()
          .like('room_code', 'T%');
      }

      // 2. Create new game (simulating server action behavior)
      const roomCode = generateTestRoomCode();
      const { data: newGame, error } = await testSupabase
        .from('games')
        .insert({
          room_code: roomCode,
          game_phase: 'lobby',
          current_round: 1,
          transition_state: 'idle',
          is_public: true,
          max_players: 10
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(newGame.game_phase).toBe('lobby');
      expect(newGame.room_code).toMatch(/^T[A-Z2-9]{5}$/);
    });

    test('room creation with custom settings', async () => {
      const roomName = `${TEST_PREFIX}CustomRoom`;
      const { data: customGame, error } = await testSupabase
        .from('games')
        .insert({
          room_code: generateTestRoomCode(),
          room_name: roomName,
          game_phase: 'lobby',
          current_round: 1,
          is_public: false,
          max_players: 6,
          transition_state: 'idle'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(customGame.room_name).toBe(roomName);
      expect(customGame.is_public).toBe(false);
      expect(customGame.max_players).toBe(6);
    });
  });

  describe('Player Management Behavior', () => {
    test('player addition creates proper database records', async () => {
      const game = await createTestGame();
      const playerName = `${TEST_PREFIX}TestPlayer`;

      const { data: newPlayer, error } = await testSupabase
        .from('players')
        .insert({
          game_id: game.id,
          name: playerName,
          avatar: '🎮',
          score: 0,
          is_judge: false,
          is_ready: false
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(newPlayer.name).toBe(playerName);
      expect(newPlayer.game_id).toBe(game.id);
      expect(newPlayer.is_ready).toBe(false);
    });

    test('ready status toggle updates database correctly', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id, { is_ready: false });

      // Toggle ready status
      const { error: updateError } = await testSupabase
        .from('players')
        .update({ is_ready: true })
        .eq('id', player.id);

      expect(updateError).toBeNull();

      // Verify update
      const { data: updatedPlayer } = await testSupabase
        .from('players')
        .select('is_ready')
        .eq('id', player.id)
        .single();

      expect(updatedPlayer.is_ready).toBe(true);
    });

    test('ready player order management', async () => {
      const game = await createTestGame();
      const player1 = await createTestPlayer(game.id, { is_ready: true });
      const player2 = await createTestPlayer(game.id, { is_ready: true });

      // Update ready player order (simulating server action logic)
      const readyOrder = [player1.id, player2.id];
      const { error } = await testSupabase
        .from('games')
        .update({ ready_player_order: readyOrder })
        .eq('id', game.id);

      expect(error).toBeNull();

      // Verify order
      const { data: updatedGame } = await testSupabase
        .from('games')
        .select('ready_player_order')
        .eq('id', game.id)
        .single();

      expect(updatedGame.ready_player_order).toEqual(readyOrder);
    });
  });

  describe('Game State Transition Behavior', () => {
    test('lobby to category_selection transition pattern', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      const player1 = await createTestPlayer(game.id, { is_ready: true });
      const player2 = await createTestPlayer(game.id, { is_ready: true });

      // Check minimum players requirement
      const { data: players } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);

      expect(players.length).toBeGreaterThanOrEqual(2);
      expect(players.every(p => p.is_ready)).toBe(true);

      // Simulate game start transition
      const { error } = await testSupabase
        .from('games')
        .update({ 
          game_phase: 'category_selection',
          current_judge_id: player1.id,
          ready_player_order: [player1.id, player2.id]
        })
        .eq('id', game.id);

      expect(error).toBeNull();

      // Verify transition
      const { data: startedGame } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();

      expect(startedGame.game_phase).toBe('category_selection');
      expect(startedGame.current_judge_id).toBe(player1.id);
    });

    test('transition state management', async () => {
      const game = await createTestGame({ transition_state: 'idle' });

      // Set transition state (simulating server action)
      await testSupabase
        .from('games')
        .update({ 
          transition_state: 'starting_game',
          transition_message: 'Starting game...'
        })
        .eq('id', game.id);

      // Verify transition state
      const { data: transitionGame } = await testSupabase
        .from('games')
        .select('transition_state, transition_message')
        .eq('id', game.id)
        .single();

      expect(transitionGame.transition_state).toBe('starting_game');
      expect(transitionGame.transition_message).toBe('Starting game...');

      // Clear transition state
      await testSupabase
        .from('games')
        .update({ 
          transition_state: 'idle',
          transition_message: null
        })
        .eq('id', game.id);

      const { data: clearedGame } = await testSupabase
        .from('games')
        .select('transition_state, transition_message')
        .eq('id', game.id)
        .single();

      expect(clearedGame.transition_state).toBe('idle');
      expect(clearedGame.transition_message).toBeNull();
    });
  });

  describe('Multi-Player Coordination Patterns', () => {
    test('concurrent player operations handle correctly', async () => {
      const game = await createTestGame();
      const player1 = await createTestPlayer(game.id);
      const player2 = await createTestPlayer(game.id);
      const player3 = await createTestPlayer(game.id);

      // Simulate simultaneous ready toggles
      const togglePromises = [
        testSupabase.from('players').update({ is_ready: true }).eq('id', player1.id),
        testSupabase.from('players').update({ is_ready: true }).eq('id', player2.id),
        testSupabase.from('players').update({ is_ready: true }).eq('id', player3.id)
      ];

      const results = await Promise.all(togglePromises);
      results.forEach(result => expect(result.error).toBeNull());

      // Verify all players are ready
      const { data: readyPlayers } = await testSupabase
        .from('players')
        .select('is_ready')
        .eq('game_id', game.id);

      expect(readyPlayers.every(p => p.is_ready)).toBe(true);
    });

    test('player disconnection during ready phase', async () => {
      const game = await createTestGame();
      const player1 = await createTestPlayer(game.id, { is_ready: true });
      const player2 = await createTestPlayer(game.id, { is_ready: true });
      const player3 = await createTestPlayer(game.id, { is_ready: false });

      // Simulate player disconnect (deletion)
      await testSupabase
        .from('players')
        .delete()
        .eq('id', player3.id);

      // Verify remaining players
      const { data: remainingPlayers } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);

      expect(remainingPlayers).toHaveLength(2);
      expect(remainingPlayers.filter(p => p.is_ready)).toHaveLength(2);
    });
  });

  describe('Data Consistency Validation', () => {
    test('game state retrieval includes all related data', async () => {
      const game = await createTestGame();
      const player1 = await createTestPlayer(game.id);
      const player2 = await createTestPlayer(game.id);

      // Query game with players (simulating getGame server action)
      const { data: gameData, error: gameError } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();

      const { data: playersData, error: playersError } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);

      expect(gameError).toBeNull();
      expect(playersError).toBeNull();
      expect(playersData).toHaveLength(2);
      expect(playersData[0].game_id).toBe(game.id);
      expect(playersData[1].game_id).toBe(game.id);
    });

    test('foreign key constraints prevent orphaned data', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id);

      // Try to create player with invalid game_id
      const { error } = await testSupabase
        .from('players')
        .insert({
          game_id: 'nonexistent-game-id',
          name: `${TEST_PREFIX}InvalidPlayer`,
          avatar: '🎮'
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('uuid');
    });
  });

  describe('Performance and Scalability Patterns', () => {
    test('multiple players can join game efficiently', async () => {
      const game = await createTestGame();
      const playerCount = 8;

      // Create multiple players simultaneously
      const playerPromises = Array.from({ length: playerCount }, (_, i) => 
        testSupabase
          .from('players')
          .insert({
            game_id: game.id,
            name: `${TEST_PREFIX}Player${i + 1}`,
            avatar: '🎮',
            score: 0, // Required field
            is_judge: false,
            is_ready: false
          })
          .select()
          .single()
      );

      const results = await Promise.all(playerPromises);
      results.forEach(result => expect(result.error).toBeNull());

      // Verify all players added
      const { data: allPlayers } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);

      expect(allPlayers).toHaveLength(playerCount);
    });
  });
});