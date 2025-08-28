/**
 * Authorization System Integration Tests
 * 
 * Tests the JWT token system and authorization helpers to ensure
 * proper security controls are in place for all server actions.
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase
} from '../helpers/testDatabase';

import {
  createPlayerToken,
  verifyPlayerToken,
  setPlayerSession,
  getPlayerSession,
  clearPlayerSession
} from '../../src/lib/auth';

import {
  validateGameMembership,
  validateCurrentJudge,
  validateGameHost,
  requireGameMembership,
  requireJudgeAccess,
  requireHostAccess
} from '../../src/lib/gameAuth';

import {
  getCurrentPlayerSession,
  selectCategory,
  submitResponse,
  selectWinner,
  startGame,
  togglePlayerReadyStatus,
  getCurrentPlayer
} from '../../src/app/game/actions';

describe('Authorization System Integration Tests', () => {
  let testGameId: string;
  let testPlayerId: string;
  let testJudgeId: string;
  let testHostId: string;
  
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Create test game and players for each test
    const game = await createTestGame('Authorization Test Game');
    testGameId = game.id;
    
    // Create host player (first player)
    const hostPlayer = await createTestPlayer(testGameId, 'TestHost', '👑');
    testHostId = hostPlayer.id;
    
    // Set host in game
    await testSupabase
      .from('games')
      .update({ created_by_player_id: testHostId })
      .eq('id', testGameId);
    
    // Create regular player
    const regularPlayer = await createTestPlayer(testGameId, 'TestPlayer', '😊');
    testPlayerId = regularPlayer.id;
    
    // Create judge player and set as current judge
    const judgePlayer = await createTestPlayer(testGameId, 'TestJudge', '⚖️');
    testJudgeId = judgePlayer.id;
    
    await testSupabase
      .from('games')
      .update({ 
        current_judge_id: testJudgeId,
        ready_player_order: [testHostId, testPlayerId, testJudgeId]
      })
      .eq('id', testGameId);
  });

  afterEach(async () => {
    await clearPlayerSession();
    await cleanupTestData();
  });

  describe('JWT Token System', () => {
    test('should create and verify valid JWT tokens', async () => {
      const token = await createPlayerToken(testPlayerId, testGameId, 'player');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const validation = await verifyPlayerToken(token);
      expect(validation.valid).toBe(true);
      expect(validation.token?.playerId).toBe(testPlayerId);
      expect(validation.token?.gameId).toBe(testGameId);
      expect(validation.token?.role).toBe('player');
    });

    test('should reject invalid JWT tokens', async () => {
      const invalidToken = 'invalid-jwt-token';
      const validation = await verifyPlayerToken(invalidToken);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeTruthy();
    });

    test('should handle different player roles in tokens', async () => {
      const roles = ['player', 'judge', 'host'] as const;
      
      for (const role of roles) {
        const token = await createPlayerToken(testPlayerId, testGameId, role);
        const validation = await verifyPlayerToken(token);
        expect(validation.valid).toBe(true);
        expect(validation.token?.role).toBe(role);
      }
    });
  });

  describe('Session Management', () => {
    test('should establish and retrieve player sessions', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const session = await getPlayerSession();
      expect(session.valid).toBe(true);
      expect(session.token?.playerId).toBe(testPlayerId);
      expect(session.token?.gameId).toBe(testGameId);
    });

    test('should clear player sessions', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await clearPlayerSession();
      
      const session = await getPlayerSession();
      expect(session.valid).toBe(false);
    });

    test('should handle missing sessions gracefully', async () => {
      const session = await getPlayerSession();
      expect(session.valid).toBe(false);
      expect(session.error).toContain('No session token found');
    });
  });

  describe('Authorization Helpers', () => {
    test('should validate game membership correctly', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const result = await validateGameMembership(testGameId);
      expect(result.authorized).toBe(true);
      expect(result.playerId).toBe(testPlayerId);
    });

    test('should reject membership for wrong game', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const wrongGameId = 'wrong-game-id';
      const result = await validateGameMembership(wrongGameId);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Session is for different game');
    });

    test('should validate judge access correctly', async () => {
      await setPlayerSession(testJudgeId, testGameId, 'judge');
      
      const result = await validateCurrentJudge(testGameId);
      expect(result.authorized).toBe(true);
      expect(result.playerId).toBe(testJudgeId);
    });

    test('should reject non-judge as judge', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const result = await validateCurrentJudge(testGameId);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('not the current judge');
    });

    test('should validate host access correctly', async () => {
      await setPlayerSession(testHostId, testGameId, 'host');
      
      const result = await validateGameHost(testGameId);
      expect(result.authorized).toBe(true);
      expect(result.playerId).toBe(testHostId);
    });

    test('should reject non-host as host', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const result = await validateGameHost(testGameId);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('not the room host');
    });
  });

  describe('Server Action Authorization', () => {
    test('should protect judge-only actions', async () => {
      // Test selectCategory requires judge access
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      await expect(selectCategory(testGameId, 'test-category')).rejects.toThrow('Not the current judge');
      
      // Should work for judge
      await setPlayerSession(testJudgeId, testGameId, 'judge');
      // Note: This may fail due to game phase, but should pass authorization
      try {
        await selectCategory(testGameId, 'test-category');
      } catch (error) {
        // Should be a game logic error, not an authorization error
        expect(error.message).not.toContain('Unauthorized');
        expect(error.message).not.toContain('Not the current judge');
      }
    });

    test('should protect host-only actions', async () => {
      // Test startGame requires host access
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      await expect(startGame(testGameId)).rejects.toThrow('Not the room host');
      
      // Should work for host
      await setPlayerSession(testHostId, testGameId, 'host');
      // Note: This may fail due to game phase, but should pass authorization
      try {
        await startGame(testGameId);
      } catch (error) {
        // Should be a game logic error, not an authorization error
        expect(error.message).not.toContain('Unauthorized');
        expect(error.message).not.toContain('Not the room host');
      }
    });

    test('should protect player-specific actions', async () => {
      // Test togglePlayerReadyStatus requires matching player
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      // Should fail for different player
      await expect(togglePlayerReadyStatus(testJudgeId, testGameId)).rejects.toThrow('Cannot toggle ready status for other players');
      
      // Should work for same player
      const result = await togglePlayerReadyStatus(testPlayerId, testGameId);
      expect(result).toBeTruthy();
    });

    test('should protect getCurrentPlayer data access', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      // Should fail for different player
      await expect(getCurrentPlayer(testJudgeId, testGameId)).rejects.toThrow('Cannot access other players\' data');
      
      // Should work for same player
      const player = await getCurrentPlayer(testPlayerId, testGameId);
      expect(player?.id).toBe(testPlayerId);
    });

    test('should protect submitResponse with player validation', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      // Should fail for different player
      await expect(
        submitResponse(testJudgeId, 'test response', testGameId, 1, false)
      ).rejects.toThrow('Cannot submit responses for other players');
    });
  });

  describe('Session Integration', () => {
    test('getCurrentPlayerSession should return valid session data', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const sessionData = await getCurrentPlayerSession();
      expect(sessionData).toBeTruthy();
      expect(sessionData?.playerId).toBe(testPlayerId);
      expect(sessionData?.gameId).toBe(testGameId);
      expect(sessionData?.role).toBe('player');
    });

    test('getCurrentPlayerSession should return null for no session', async () => {
      const sessionData = await getCurrentPlayerSession();
      expect(sessionData).toBeNull();
    });
  });

  describe('Development Mode Bypass', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    
    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should bypass auth in development mode when authorized', async () => {
      process.env.NODE_ENV = 'development';
      await setPlayerSession(testJudgeId, testGameId, 'judge');
      
      // Should work normally with valid auth
      const playerId = await requireJudgeAccess(testGameId);
      expect(playerId).toBe(testJudgeId);
    });

    test('should still enforce auth in production mode', async () => {
      process.env.NODE_ENV = 'production';
      // No session established
      
      await expect(requireGameMembership(testGameId)).rejects.toThrow('Unauthorized');
    });
  });
});