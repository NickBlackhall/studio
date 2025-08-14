import { createMockGame, createMockPlayer } from '../../fixtures/mockData';
import { MIN_PLAYERS_TO_START } from '../../../src/lib/types';

describe('Player Validation Logic', () => {
  describe('Ready Player Validation', () => {
    test('counts ready players correctly', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true }),
          createMockPlayer({ id: 'p3', isReady: false }),
        ]
      });

      const readyPlayers = game.players.filter(p => p.isReady);
      expect(readyPlayers).toHaveLength(2);
    });

    test('identifies all players ready', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true }),
        ]
      });

      const allReady = game.players.every(p => p.isReady);
      expect(allReady).toBe(true);
    });

    test('identifies when not all players ready', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: false }),
        ]
      });

      const allReady = game.players.every(p => p.isReady);
      expect(allReady).toBe(false);
    });
  });

  describe('Minimum Player Requirements', () => {
    test('has enough players to start with minimum', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true }),
        ]
      });

      const hasEnoughPlayers = game.players.length >= MIN_PLAYERS_TO_START;
      expect(hasEnoughPlayers).toBe(true);
    });

    test('does not have enough players with only one', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
        ]
      });

      const hasEnoughPlayers = game.players.length >= MIN_PLAYERS_TO_START;
      expect(hasEnoughPlayers).toBe(false);
    });

    test('can start game when minimum ready players met', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true }),
          createMockPlayer({ id: 'p3', isReady: false }),
        ]
      });

      const readyPlayers = game.players.filter(p => p.isReady);
      const canStart = readyPlayers.length >= MIN_PLAYERS_TO_START;
      expect(canStart).toBe(true);
    });

    test('cannot start game when insufficient ready players', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: false }),
          createMockPlayer({ id: 'p3', isReady: false }),
        ]
      });

      const readyPlayers = game.players.filter(p => p.isReady);
      const canStart = readyPlayers.length >= MIN_PLAYERS_TO_START;
      expect(canStart).toBe(false);
    });
  });

  describe('Ready Player Order', () => {
    test('ready_player_order matches ready players', () => {
      const readyPlayerIds = ['p1', 'p2'];
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: true }),
          createMockPlayer({ id: 'p3', isReady: false }),
        ],
        ready_player_order: readyPlayerIds
      });

      const actualReadyIds = game.players.filter(p => p.isReady).map(p => p.id);
      expect(game.ready_player_order).toEqual(expect.arrayContaining(actualReadyIds));
    });

    test('ready_player_order excludes non-ready players', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: false }),
        ],
        ready_player_order: ['p1'] // Only ready player
      });

      expect(game.ready_player_order).not.toContain('p2');
      expect(game.ready_player_order).toContain('p1');
    });
  });
});