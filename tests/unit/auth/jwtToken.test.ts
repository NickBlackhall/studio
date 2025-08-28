/**
 * JWT Token System Unit Tests
 * 
 * Tests the core JWT token creation and verification logic
 * independently of Next.js request context.
 */

import {
  createPlayerToken,
  verifyPlayerToken
} from '../../../src/lib/auth';

describe('JWT Token System', () => {
  const testPlayerId = 'test-player-123';
  const testGameId = 'test-game-456';

  describe('Token Creation and Verification', () => {
    test('should create and verify valid JWT tokens', async () => {
      const token = await createPlayerToken(testPlayerId, testGameId, 'player');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      
      const validation = await verifyPlayerToken(token);
      expect(validation.valid).toBe(true);
      expect(validation.token?.playerId).toBe(testPlayerId);
      expect(validation.token?.gameId).toBe(testGameId);
      expect(validation.token?.role).toBe('player');
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

    test('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-jwt-token',
        'header.payload', // Missing signature
        'a.b.c', // Invalid structure
        '', // Empty string
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid', // Invalid payload
      ];
      
      for (const invalidToken of invalidTokens) {
        const validation = await verifyPlayerToken(invalidToken);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeTruthy();
      }
    });

    test('should include expiration in token payload', async () => {
      const token = await createPlayerToken(testPlayerId, testGameId, 'player');
      const validation = await verifyPlayerToken(token);
      
      expect(validation.valid).toBe(true);
      expect(validation.token?.exp).toBeTruthy();
      expect(typeof validation.token?.exp).toBe('number');
    });

    test('should create tokens with proper HMAC signature', async () => {
      const token1 = await createPlayerToken(testPlayerId, testGameId, 'player');
      const token2 = await createPlayerToken(testPlayerId, testGameId, 'player');
      
      // Tokens for same data should be different (due to timestamps)
      expect(token1).not.toBe(token2);
      
      // But both should be valid
      const validation1 = await verifyPlayerToken(token1);
      const validation2 = await verifyPlayerToken(token2);
      
      expect(validation1.valid).toBe(true);
      expect(validation2.valid).toBe(true);
    });

    test('should prevent token tampering', async () => {
      const token = await createPlayerToken(testPlayerId, testGameId, 'player');
      
      // Attempt to tamper with the token by changing one character
      const tamperedToken = token.slice(0, -1) + 'X';
      
      const validation = await verifyPlayerToken(tamperedToken);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Invalid');
    });

    test('should include all required fields in token payload', async () => {
      const token = await createPlayerToken(testPlayerId, testGameId, 'judge');
      const validation = await verifyPlayerToken(token);
      
      expect(validation.valid).toBe(true);
      expect(validation.token).toBeDefined();
      
      // Verify all required fields are present
      const payload = validation.token!;
      expect(payload.playerId).toBe(testPlayerId);
      expect(payload.gameId).toBe(testGameId);
      expect(payload.role).toBe('judge');
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined(); // Issued at time
    });
  });

  describe('Security Properties', () => {
    test('should use different signatures for different data', async () => {
      const token1 = await createPlayerToken('player1', 'game1', 'player');
      const token2 = await createPlayerToken('player2', 'game1', 'player');
      const token3 = await createPlayerToken('player1', 'game2', 'player');
      const token4 = await createPlayerToken('player1', 'game1', 'judge');
      
      // All tokens should be different
      const tokens = [token1, token2, token3, token4];
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(4);
      
      // Verify each token contains the correct data
      const validation1 = await verifyPlayerToken(token1);
      const validation2 = await verifyPlayerToken(token2);
      const validation3 = await verifyPlayerToken(token3);
      const validation4 = await verifyPlayerToken(token4);
      
      expect(validation1.token?.playerId).toBe('player1');
      expect(validation2.token?.playerId).toBe('player2');
      expect(validation3.token?.gameId).toBe('game2');
      expect(validation4.token?.role).toBe('judge');
    });

    test('should reject tokens with invalid structure', async () => {
      const validToken = await createPlayerToken(testPlayerId, testGameId, 'player');
      const parts = validToken.split('.');
      
      // Test various malformed tokens
      const malformedTokens = [
        parts[0], // Only header
        parts[0] + '.' + parts[1], // Missing signature
        'invalid.' + parts[1] + '.' + parts[2], // Invalid header
        parts[0] + '.invalid.' + parts[2], // Invalid payload
        parts[0] + '.' + parts[1] + '.invalid', // Invalid signature
      ];
      
      for (const malformedToken of malformedTokens) {
        const validation = await verifyPlayerToken(malformedToken);
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle edge cases gracefully', async () => {
      // Test with empty/null values - should still create valid tokens
      const edgeCases = [
        ['', testGameId, 'player'],
        [testPlayerId, '', 'player'],
        [testPlayerId, testGameId, 'player' as const],
      ];
      
      for (const [playerId, gameId, role] of edgeCases) {
        const token = await createPlayerToken(playerId, gameId, role);
        const validation = await verifyPlayerToken(token);
        
        expect(validation.valid).toBe(true);
        expect(validation.token?.playerId).toBe(playerId);
        expect(validation.token?.gameId).toBe(gameId);
        expect(validation.token?.role).toBe(role);
      }
    });

    test('should provide meaningful error messages', async () => {
      const invalidToken = 'clearly-invalid-token';
      const validation = await verifyPlayerToken(invalidToken);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeTruthy();
      expect(typeof validation.error).toBe('string');
      expect(validation.error!.length).toBeGreaterThan(0);
    });
  });
});