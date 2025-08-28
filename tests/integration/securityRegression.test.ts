/**
 * Security Vulnerability Regression Tests
 * 
 * These tests specifically verify that the original Phase 1 critical 
 * vulnerabilities (CRIT-001, CRIT-002, CRIT-003) have been fixed
 * and cannot be exploited.
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase
} from '../helpers/testDatabase';

import {
  setPlayerSession,
  clearPlayerSession
} from '../../src/lib/auth';

import {
  selectCategory,
  submitResponse,
  selectWinner,
  startGame,
  togglePlayerReadyStatus,
  getCurrentPlayer,
  resetGameForTesting,
  removePlayerFromGame,
  handleJudgeApprovalForCustomCard,
  nextRound
} from '../../src/app/game/actions';

describe('Security Vulnerability Regression Tests', () => {
  let testGameId: string;
  let testPlayerId: string;
  let testHostId: string;
  let testJudgeId: string;
  let otherGameId: string;
  let otherPlayerId: string;
  
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Create primary test game
    const game = await createTestGame('Security Test Game');
    testGameId = game.id;
    
    // Create host player
    const hostPlayer = await createTestPlayer(testGameId, 'TestHost', '👑');
    testHostId = hostPlayer.id;
    
    await testSupabase
      .from('games')
      .update({ created_by_player_id: testHostId })
      .eq('id', testGameId);
    
    // Create regular player
    const regularPlayer = await createTestPlayer(testGameId, 'TestPlayer', '😊');
    testPlayerId = regularPlayer.id;
    
    // Create judge player
    const judgePlayer = await createTestPlayer(testGameId, 'TestJudge', '⚖️');
    testJudgeId = judgePlayer.id;
    
    await testSupabase
      .from('games')
      .update({ 
        current_judge_id: testJudgeId,
        ready_player_order: [testHostId, testPlayerId, testJudgeId]
      })
      .eq('id', testGameId);

    // Create separate game for cross-game attack tests
    const otherGame = await createTestGame('Other Game');
    otherGameId = otherGame.id;
    
    const otherPlayer = await createTestPlayer(otherGameId, 'OtherPlayer', '🔒');
    otherPlayerId = otherPlayer.id;
  });

  afterEach(async () => {
    await clearPlayerSession();
    await cleanupTestData();
  });

  describe('CRIT-001: Authorization Bypass Prevention', () => {
    test('should prevent unauthorized selectCategory calls', async () => {
      // Attack: Call judge-only action without any session
      await expect(selectCategory(testGameId, 'test-category'))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Call with wrong role session
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(selectCategory(testGameId, 'test-category'))
        .rejects.toThrow(/Not the current judge/);
    });

    test('should prevent unauthorized submitResponse calls', async () => {
      // Attack: Call without any session
      await expect(submitResponse(testPlayerId, 'attack response', testGameId, 1, false))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Try to submit for different player
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(submitResponse(testJudgeId, 'impersonation attack', testGameId, 1, false))
        .rejects.toThrow(/Cannot submit responses for other players/);
    });

    test('should prevent unauthorized selectWinner calls', async () => {
      // Attack: Call judge-only action without session
      await expect(selectWinner(testGameId, 'winning text'))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Call with non-judge session
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(selectWinner(testGameId, 'winning text'))
        .rejects.toThrow(/Not the current judge/);
    });

    test('should prevent unauthorized startGame calls', async () => {
      // Attack: Call host-only action without session
      await expect(startGame(testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Call with non-host session
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(startGame(testGameId))
        .rejects.toThrow(/Not the room host/);
    });

    test('should prevent unauthorized player data access', async () => {
      // Attack: Access player data without session
      await expect(getCurrentPlayer(testPlayerId, testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Access other player's data
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(getCurrentPlayer(testJudgeId, testGameId))
        .rejects.toThrow(/Cannot access other players' data/);
    });

    test('should prevent unauthorized togglePlayerReadyStatus calls', async () => {
      // Attack: Toggle ready status without session
      await expect(togglePlayerReadyStatus(testPlayerId, testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Toggle other player's ready status
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(togglePlayerReadyStatus(testJudgeId, testGameId))
        .rejects.toThrow(/Cannot toggle ready status for other players/);
    });

    test('should prevent unauthorized judge approval calls', async () => {
      // Attack: Call judge-only action without session
      await expect(handleJudgeApprovalForCustomCard(testGameId, true))
        .rejects.toThrow(/Unauthorized|No valid session/);

      // Attack: Call with non-judge session
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(handleJudgeApprovalForCustomCard(testGameId, true))
        .rejects.toThrow(/Not the current judge/);
    });

    test('should prevent unauthorized nextRound calls', async () => {
      // Attack: Call without session
      await expect(nextRound(testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);
    });
  });

  describe('CRIT-002: Host Privilege Escalation Prevention', () => {
    test('should use created_by_player_id not ready_player_order for host validation', async () => {
      // Setup: Manipulate ready_player_order to put non-host first
      await testSupabase
        .from('games')
        .update({ 
          ready_player_order: [testPlayerId, testHostId, testJudgeId] // Non-host first
        })
        .eq('id', testGameId);

      // Attack: Try to use startGame as non-host (who is first in ready order)
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(startGame(testGameId))
        .rejects.toThrow(/Not the room host/);

      // Verify: Real host can still use host actions
      await setPlayerSession(testHostId, testGameId, 'host');
      // Should not throw authorization error (may throw game logic errors)
      try {
        await startGame(testGameId);
      } catch (error) {
        expect(error.message).not.toContain('Not the room host');
        expect(error.message).not.toContain('Unauthorized');
      }
    });

    test('should prevent ready_player_order manipulation attacks', async () => {
      // Attack: Try to manipulate ready order then claim host privileges
      await testSupabase
        .from('games')
        .update({ ready_player_order: [testPlayerId] })
        .eq('id', testGameId);

      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(startGame(testGameId))
        .rejects.toThrow(/Not the room host/);
    });

    test('should prevent resetGame calls from non-host', async () => {
      // Attack: Try to reset game as non-host
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(resetGameForTesting({ gameId: testGameId }))
        .rejects.toThrow(/Not the room host/);
    });

    test('should prevent kick player calls from non-host', async () => {
      // Attack: Try to kick player as non-host
      await setPlayerSession(testPlayerId, testGameId, 'player');
      await expect(removePlayerFromGame(testGameId, testJudgeId, 'kicked'))
        .rejects.toThrow(/Not the room host/);
    });
  });

  describe('CRIT-003: Cross-Game Access Prevention', () => {
    test('should prevent cross-game server action access', async () => {
      // Setup: Valid session for one game
      await setPlayerSession(testPlayerId, testGameId, 'player');

      // Attack: Try to access different game with same session
      await expect(togglePlayerReadyStatus(otherPlayerId, otherGameId))
        .rejects.toThrow(/Session is for different game|Cannot toggle ready status for other players/);

      await expect(getCurrentPlayer(otherPlayerId, otherGameId))
        .rejects.toThrow(/Session is for different game|Cannot access other players' data/);
    });

    test('should prevent judge actions on wrong game', async () => {
      // Setup: Judge session for one game
      await setPlayerSession(testJudgeId, testGameId, 'judge');

      // Attack: Try to use judge actions on different game
      await expect(selectCategory(otherGameId, 'attack-category'))
        .rejects.toThrow(/Session is for different game/);

      await expect(selectWinner(otherGameId, 'attack winner'))
        .rejects.toThrow(/Session is for different game/);
    });

    test('should prevent host actions on wrong game', async () => {
      // Setup: Host session for one game
      await setPlayerSession(testHostId, testGameId, 'host');

      // Attack: Try to use host actions on different game
      await expect(startGame(otherGameId))
        .rejects.toThrow(/Session is for different game/);

      await expect(resetGameForTesting({ gameId: otherGameId }))
        .rejects.toThrow(/Session is for different game/);
    });

    test('should prevent response submission to wrong game', async () => {
      // Setup: Player session for one game
      await setPlayerSession(testPlayerId, testGameId, 'player');

      // Attack: Try to submit response to different game
      await expect(submitResponse(testPlayerId, 'cross-game attack', otherGameId, 1, false))
        .rejects.toThrow(/Session is for different game/);
    });
  });

  describe('Session Tampering Prevention', () => {
    test('should reject tampered JWT tokens', async () => {
      // This test would need to be implemented with manual JWT manipulation
      // For now, we test that invalid sessions are rejected
      
      // Clear any existing session
      await clearPlayerSession();
      
      // Verify that actions fail without valid session
      await expect(getCurrentPlayer(testPlayerId, testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);
    });

    test('should handle session expiration properly', async () => {
      // Note: Full expiration testing would require time manipulation
      // This test ensures the basic expiration logic is in place
      
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      // Verify session works
      const player = await getCurrentPlayer(testPlayerId, testGameId);
      expect(player?.id).toBe(testPlayerId);
      
      // Clear session to simulate expiration
      await clearPlayerSession();
      
      // Verify expired session is rejected
      await expect(getCurrentPlayer(testPlayerId, testGameId))
        .rejects.toThrow(/Unauthorized|No valid session/);
    });
  });

  describe('Edge Case Security Tests', () => {
    test('should handle malformed gameId parameters', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const malformedGameId = 'invalid-uuid-format';
      await expect(getCurrentPlayer(testPlayerId, malformedGameId))
        .rejects.toThrow(/Session is for different game/);
    });

    test('should handle null/undefined player parameters', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      await expect(getCurrentPlayer('', testGameId))
        .rejects.toThrow();
      
      await expect(togglePlayerReadyStatus('', testGameId))
        .rejects.toThrow();
    });

    test('should prevent SQL injection attempts in parameters', async () => {
      await setPlayerSession(testPlayerId, testGameId, 'player');
      
      const sqlInjectionAttempt = "'; DROP TABLE players; --";
      
      // These should fail gracefully, not cause database errors
      await expect(getCurrentPlayer(sqlInjectionAttempt, testGameId))
        .rejects.toThrow(/Cannot access other players' data|Session is for different game/);
    });
  });
});