/**
 * Navigation Flow Integration Tests
 * Tests the critical user journeys and state transitions that were causing issues
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  TEST_PREFIX
} from '../helpers/testDatabase';

import {
  findOrCreateGame,
  addPlayer,
  togglePlayerReadyStatus,
  startGame,
  getGame
} from '../../src/app/game/actions';

describe('Integration - Navigation Flow', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Name/Avatar → Lobby Flow', () => {
    test('new player journey: create game → add player → lobby state', async () => {
      // Simulate: User enters name/avatar and clicks "Create Game"
      const game = await findOrCreateGame();
      expect(game.game_phase).toBe('lobby');
      
      // Simulate: Player gets added to game
      const playerName = `${TEST_PREFIX}NewPlayer`;
      const player = await addPlayer(playerName, '🎮', game.id);
      expect(player).toBeDefined();
      
      // Simulate: Check lobby state after player joins
      const lobbyState = await getGame(game.id);
      expect(lobbyState.gamePhase).toBe('lobby');
      expect(lobbyState.players).toHaveLength(1);
      expect(lobbyState.players[0].name).toBe(playerName);
      expect(lobbyState.players[0].isReady).toBe(false);
    });

    test('existing lobby: player joins existing game', async () => {
      // Setup: Game already exists in lobby
      const existingGame = await createTestGame({ game_phase: 'lobby' });
      const existingPlayer = await createTestPlayer(existingGame.id, { 
        name: `${TEST_PREFIX}ExistingPlayer` 
      });
      
      // Simulate: New player tries to join
      const joinedGame = await findOrCreateGame();
      expect(joinedGame.id).toBe(existingGame.id); // Should find existing game
      
      const newPlayer = await addPlayer(`${TEST_PREFIX}NewPlayer`, '🎭', joinedGame.id);
      
      // Verify: Both players in same lobby
      const lobbyState = await getGame(existingGame.id);
      expect(lobbyState.players).toHaveLength(2);
      expect(lobbyState.gamePhase).toBe('lobby');
    });
  });

  describe('Lobby → Game Flow', () => {
    test('successful game start: ready players → game begins', async () => {
      // Setup: Game with 2 players in lobby
      const game = await createTestGame({ game_phase: 'lobby' });
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      // Simulate: Players mark themselves ready
      await togglePlayerReadyStatus(player1!.id, game.id);
      await togglePlayerReadyStatus(player2!.id, game.id);
      
      // Verify: Both players ready in lobby
      const readyLobby = await getGame(game.id);
      expect(readyLobby.gamePhase).toBe('lobby');
      expect(readyLobby.players.every(p => p.isReady)).toBe(true);
      
      // Simulate: Game start triggered
      const startedGame = await startGame(game.id);
      
      // Verify: Transition to game successful
      expect(startedGame).toBeDefined();
      expect(startedGame!.gamePhase).toBe('category_selection');
      expect(startedGame!.currentJudgeId).toBeDefined();
    });

    test('failed game start: insufficient ready players', async () => {
      // Setup: Game with players but not all ready
      const game = await createTestGame({ game_phase: 'lobby' });
      await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      // Only one player ready
      const player1 = (await getGame(game.id)).players[0];
      await togglePlayerReadyStatus(player1.id, game.id);
      
      // Verify: Game start should fail
      await expect(startGame(game.id)).rejects.toThrow();
      
      // Verify: Game remains in lobby
      const stillLobby = await getGame(game.id);
      expect(stillLobby.gamePhase).toBe('lobby');
    });
  });

  describe('Game Phase Transitions', () => {
    test('category selection → player submission flow', async () => {
      // Setup: Game in category_selection phase
      const game = await createTestGame({ 
        game_phase: 'category_selection',
        current_judge_id: null // Will be set by startGame
      });
      
      // Add players and start game properly
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      
      await togglePlayerReadyStatus(player1!.id, game.id);
      await togglePlayerReadyStatus(player2!.id, game.id);
      
      const startedGame = await startGame(game.id);
      expect(startedGame!.gamePhase).toBe('category_selection');
      
      // TODO: Add category selection and transition to player_submission
      // This would require implementing selectCategory action test
    });
  });

  describe('Multi-Player Coordination', () => {
    test('simultaneous player ready toggles work correctly', async () => {
      // Setup: Game with 3 players
      const game = await createTestGame({ game_phase: 'lobby' });
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      const player3 = await addPlayer(`${TEST_PREFIX}Player3`, '🎪', game.id);
      
      // Simulate: All players click ready simultaneously
      const readyPromises = [
        togglePlayerReadyStatus(player1!.id, game.id),
        togglePlayerReadyStatus(player2!.id, game.id),
        togglePlayerReadyStatus(player3!.id, game.id)
      ];
      
      const results = await Promise.all(readyPromises);
      
      // Verify: All operations succeeded
      results.forEach(result => expect(result).toBeDefined());
      
      // Verify: Final state has all players ready
      const finalState = await getGame(game.id);
      expect(finalState.players.every(p => p.isReady)).toBe(true);
    });

    test('player disconnection during ready phase', async () => {
      // Setup: Game with 3 players, 2 ready
      const game = await createTestGame({ game_phase: 'lobby' });
      const player1 = await addPlayer(`${TEST_PREFIX}Player1`, '🎮', game.id);
      const player2 = await addPlayer(`${TEST_PREFIX}Player2`, '🎭', game.id);
      const player3 = await addPlayer(`${TEST_PREFIX}Player3`, '🎪', game.id);
      
      await togglePlayerReadyStatus(player1!.id, game.id);
      await togglePlayerReadyStatus(player2!.id, game.id);
      
      // Simulate: Player 3 disconnects (gets removed)
      await testSupabase
        .from('players')
        .delete()
        .eq('id', player3!.id);
      
      // Verify: Game still functional with remaining players
      const gameState = await getGame(game.id);
      expect(gameState.players).toHaveLength(2);
      expect(gameState.players.filter(p => p.isReady)).toHaveLength(2);
      
      // Should be able to start game with remaining ready players
      const startedGame = await startGame(game.id);
      expect(startedGame!.gamePhase).toBe('category_selection');
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('game recovery after server action failure', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      const player = await addPlayer(`${TEST_PREFIX}Player`, '🎮', game.id);
      
      // Simulate: Invalid operation that should fail
      await expect(
        togglePlayerReadyStatus('invalid-player-id', game.id)
      ).rejects.toThrow();
      
      // Verify: Game state remains consistent
      const gameState = await getGame(game.id);
      expect(gameState.gamePhase).toBe('lobby');
      expect(gameState.players).toHaveLength(1);
      expect(gameState.players[0].id).toBe(player!.id);
    });

    test('transition state recovery', async () => {
      // Setup: Game in transition state
      const game = await createTestGame({ 
        game_phase: 'lobby',
        transition_state: 'starting_game' // Stuck in transition
      });
      
      // Verify: Can still read game state
      const gameState = await getGame(game.id);
      expect(gameState.gamePhase).toBe('lobby');
      expect(gameState.transitionState).toBe('starting_game');
      
      // TODO: Add recovery mechanism testing
      // This would test how the app handles stuck transition states
    });
  });

  describe('Real-time State Synchronization', () => {
    test('database changes reflect immediately in getGame', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Direct database change (simulating real-time update)
      await testSupabase
        .from('games')
        .update({ game_phase: 'category_selection' })
        .eq('id', game.id);
      
      // Verify: getGame reflects the change
      const updatedState = await getGame(game.id);
      expect(updatedState.gamePhase).toBe('category_selection');
    });

    test('player changes propagate to game state', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      const player = await createTestPlayer(game.id, { score: 0 });
      
      // Direct player update
      await testSupabase
        .from('players')
        .update({ score: 5 })
        .eq('id', player.id);
      
      // Verify: Change appears in game state
      const gameState = await getGame(game.id);
      const updatedPlayer = gameState.players.find(p => p.id === player.id);
      expect(updatedPlayer?.score).toBe(5);
    });
  });
});