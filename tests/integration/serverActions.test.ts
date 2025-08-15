import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  TEST_PREFIX
} from '../helpers/testDatabase';

// Import server actions to test
import {
  findOrCreateGame,
  addPlayer,
  togglePlayerReadyStatus,
  startGame,
  getGame,
  createRoom,
  resetGameForTesting
} from '../../src/app/game/actions';

describe('Integration - Server Actions', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Game Creation Flow', () => {
    test('findOrCreateGame creates new game when none exist', async () => {
      const game = await findOrCreateGame();
      
      expect(game).toBeDefined();
      expect(game.id).toBeDefined();
      expect(game.game_phase).toBe('lobby');
      expect(game.room_code).toMatch(/^[A-Z2-9]{6}$/);
      expect(game.current_round).toBe(1);
    });

    test('findOrCreateGame returns existing lobby game', async () => {
      // Create a game in lobby phase
      const existingGame = await createTestGame({ game_phase: 'lobby' });
      
      const foundGame = await findOrCreateGame();
      
      expect(foundGame.id).toBe(existingGame.id);
      expect(foundGame.game_phase).toBe('lobby');
    });

    test('createRoom creates custom room with specified settings', async () => {
      const roomName = `${TEST_PREFIX}CustomRoom`;
      const game = await createRoom(roomName, false, 6);
      
      expect(game.room_name).toBe(roomName);
      expect(game.is_public).toBe(false);
      expect(game.max_players).toBe(6);
      expect(game.game_phase).toBe('lobby');
    });
  });

  describe('Player Management Flow', () => {
    test('addPlayer creates player and adds to game', async () => {
      const game = await createTestGame();
      const playerName = `${TEST_PREFIX}TestPlayer`;
      
      const player = await addPlayer(playerName, '🎮', game.id);
      
      expect(player).toBeDefined();
      expect(player?.name).toBe(playerName);
      expect(player?.avatar).toBe('🎮');
      expect(player?.game_id).toBe(game.id);
      expect(player?.is_ready).toBe(false);
      expect(player?.score).toBe(0);
    });

    test('togglePlayerReadyStatus changes ready state', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id, { is_ready: false });
      
      // Toggle to ready
      const updatedGame = await togglePlayerReadyStatus(player.id, game.id);
      
      expect(updatedGame).toBeDefined();
      const updatedPlayer = updatedGame?.players.find(p => p.id === player.id);
      expect(updatedPlayer?.isReady).toBe(true);
    });

    test('multiple players can join same game', async () => {
      const game = await createTestGame();
      
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      expect(player1?.game_id).toBe(game.id);
      expect(player2?.game_id).toBe(game.id);
      
      // Verify both players in game
      const gameState = await getGame(game.id);
      expect(gameState.players).toHaveLength(2);
    });
  });

  describe('Game State Transitions', () => {
    test('startGame transitions from lobby to category_selection', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Add minimum players and make them ready
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      await togglePlayerReadyStatus(player1!.id, game.id);
      await togglePlayerReadyStatus(player2!.id, game.id);
      
      const startedGame = await startGame(game.id);
      
      expect(startedGame).toBeDefined();
      expect(startedGame?.gamePhase).toBe('category_selection');
      expect(startedGame?.currentJudgeId).toBeDefined();
    });

    test('startGame fails with insufficient players', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Add only one player
      await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      
      await expect(startGame(game.id)).rejects.toThrow('Not enough players');
    });

    test('startGame fails with unready players', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Add players but don't make them ready
      await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      await expect(startGame(game.id)).rejects.toThrow();
    });
  });

  describe('Game State Retrieval', () => {
    test('getGame returns complete game state', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id);
      
      const gameState = await getGame(game.id);
      
      expect(gameState.gameId).toBe(game.id);
      expect(gameState.players).toHaveLength(1);
      expect(gameState.players[0].id).toBe(player.id);
      expect(gameState.gamePhase).toBe('lobby');
      expect(gameState.transitionState).toBe('idle');
    });

    test('getGame handles nonexistent game', async () => {
      await expect(getGame('nonexistent-id')).rejects.toThrow();
    });
  });

  describe('Reset and Cleanup', () => {
    test('resetGameForTesting clears game state', async () => {
      const game = await createTestGame({ game_phase: 'player_submission' });
      const player = await createTestPlayer(game.id);
      
      await resetGameForTesting();
      
      // Verify game was reset to lobby
      const gameState = await getGame(game.id);
      expect(gameState.gamePhase).toBe('lobby');
      expect(gameState.currentRound).toBe(1);
      expect(gameState.transitionState).toBe('idle');
    });
  });

  describe('Error Handling', () => {
    test('server actions handle invalid game IDs gracefully', async () => {
      await expect(togglePlayerReadyStatus('invalid-player', 'invalid-game')).rejects.toThrow();
    });

    test('addPlayer handles invalid game ID', async () => {
      const player = await addPlayer(`${TEST_PREFIX}Player`, '🎮', 'nonexistent-game');
      expect(player).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    test('multiple players can toggle ready simultaneously', async () => {
      const game = await createTestGame();
      const player1 = await createTestPlayer(game.id);
      const player2 = await createTestPlayer(game.id);
      
      // Both players toggle ready at same time
      const [result1, result2] = await Promise.all([
        togglePlayerReadyStatus(player1.id, game.id),
        togglePlayerReadyStatus(player2.id, game.id)
      ]);
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // Both should be ready
      const finalState = await getGame(game.id);
      const readyCount = finalState.players.filter(p => p.isReady).length;
      expect(readyCount).toBe(2);
    });
  });
});