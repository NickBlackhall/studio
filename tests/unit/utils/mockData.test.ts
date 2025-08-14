import { 
  createMockPlayer, 
  createMockGame, 
  createMockHand, 
  createMockScenario,
  createMockGameInPhase 
} from '../../fixtures/mockData';
import { CARDS_PER_HAND } from '../../../src/lib/types';

describe('Mock Data Utilities', () => {
  describe('createMockPlayer', () => {
    test('creates player with default values', () => {
      const player = createMockPlayer();
      
      expect(player.id).toMatch(/^player-/);
      expect(player.name).toBe('Test Player');
      expect(player.avatar).toBe('🎭');
      expect(player.score).toBe(0);
      expect(player.isJudge).toBe(false);
      expect(player.isReady).toBe(false);
      expect(player.hand).toHaveLength(CARDS_PER_HAND);
    });

    test('accepts overrides', () => {
      const player = createMockPlayer({
        name: 'Custom Player',
        score: 5,
        isJudge: true,
        isReady: true
      });

      expect(player.name).toBe('Custom Player');
      expect(player.score).toBe(5);
      expect(player.isJudge).toBe(true);
      expect(player.isReady).toBe(true);
    });
  });

  describe('createMockHand', () => {
    test('creates hand with default card count', () => {
      const hand = createMockHand();
      expect(hand).toHaveLength(CARDS_PER_HAND);
    });

    test('creates hand with custom card count', () => {
      const hand = createMockHand(3);
      expect(hand).toHaveLength(3);
    });

    test('each card has required properties', () => {
      const hand = createMockHand(1);
      const card = hand[0];
      
      expect(card.id).toMatch(/^card-/);
      expect(card.text).toMatch(/^Test Card/);
      expect(card.isNew).toBe(false);
      expect(card.isCustom).toBe(false);
    });
  });

  describe('createMockScenario', () => {
    test('creates scenario with default values', () => {
      const scenario = createMockScenario();
      
      expect(scenario.id).toMatch(/^scenario-/);
      expect(scenario.category).toBe('Test Category');
      expect(scenario.text).toBe('Test scenario text');
    });

    test('accepts overrides', () => {
      const scenario = createMockScenario({
        category: 'Custom Category',
        text: 'Custom scenario text'
      });

      expect(scenario.category).toBe('Custom Category');
      expect(scenario.text).toBe('Custom scenario text');
    });
  });

  describe('createMockGame', () => {
    test('creates game with default values', () => {
      const game = createMockGame();
      
      expect(game.gameId).toMatch(/^game-/);
      expect(game.players).toHaveLength(2);
      expect(game.currentRound).toBe(1);
      expect(game.gamePhase).toBe('lobby');
      expect(game.submissions).toHaveLength(0);
      expect(game.categories).toHaveLength(3);
      expect(game.transitionState).toBe('idle');
    });

    test('sets first player as judge by default', () => {
      const game = createMockGame();
      expect(game.currentJudgeId).toBe(game.players[0].id);
    });
  });

  describe('createMockGameInPhase', () => {
    test('creates game in lobby phase', () => {
      const game = createMockGameInPhase('lobby');
      expect(game.gamePhase).toBe('lobby');
      expect(game.currentScenario).toBeNull();
      expect(game.submissions).toHaveLength(0);
    });

    test('creates game in player_submission phase', () => {
      const game = createMockGameInPhase('player_submission');
      expect(game.gamePhase).toBe('player_submission');
      expect(game.currentScenario).not.toBeNull();
      expect(game.submissions).toHaveLength(0);
    });

    test('creates game in judging phase with submissions', () => {
      const game = createMockGameInPhase('judging', 3);
      expect(game.gamePhase).toBe('judging');
      expect(game.currentScenario).not.toBeNull();
      expect(game.submissions).toHaveLength(2); // All players except judge
    });

    test('creates game with custom player count', () => {
      const game = createMockGameInPhase('lobby', 4);
      expect(game.players).toHaveLength(4);
    });
  });
});