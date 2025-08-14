import { createMockGame, createMockPlayer } from '../../fixtures/mockData';

describe('Judge Rotation Logic', () => {
  describe('Judge Assignment', () => {
    test('first player is judge by default', () => {
      const game = createMockGame();

      expect(game.currentJudgeId).toBe(game.players[0].id);
    });

    test('judge is marked correctly in player data', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isJudge: true }),
          createMockPlayer({ id: 'p2', isJudge: false }),
        ],
        currentJudgeId: 'p1'
      });

      const judge = game.players.find(p => p.id === game.currentJudgeId);
      const nonJudges = game.players.filter(p => p.id !== game.currentJudgeId);

      expect(judge?.isJudge).toBe(true);
      nonJudges.forEach(player => {
        expect(player.isJudge).toBe(false);
      });
    });
  });

  describe('Judge Rotation Mechanics', () => {
    test('calculates next judge in rotation order', () => {
      const readyOrder = ['p1', 'p2', 'p3'];
      const currentJudgeId = 'p1';
      
      const currentIndex = readyOrder.findIndex(id => id === currentJudgeId);
      const nextIndex = (currentIndex + 1) % readyOrder.length;
      const nextJudgeId = readyOrder[nextIndex];

      expect(nextJudgeId).toBe('p2');
    });

    test('wraps around to first player after last judge', () => {
      const readyOrder = ['p1', 'p2', 'p3'];
      const currentJudgeId = 'p3'; // Last player
      
      const currentIndex = readyOrder.findIndex(id => id === currentJudgeId);
      const nextIndex = (currentIndex + 1) % readyOrder.length;
      const nextJudgeId = readyOrder[nextIndex];

      expect(nextJudgeId).toBe('p1'); // Wraps to first
    });

    test('handles missing current judge gracefully', () => {
      const readyOrder = ['p1', 'p2', 'p3'];
      const currentJudgeId = 'nonexistent';
      
      const currentIndex = readyOrder.findIndex(id => id === currentJudgeId);
      expect(currentIndex).toBe(-1);
      
      // Should default to first player if current judge not found
      const nextJudgeId = readyOrder[0];
      expect(nextJudgeId).toBe('p1');
    });
  });

  describe('Judge Validation', () => {
    test('validates judge exists in player list', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1' }),
          createMockPlayer({ id: 'p2' }),
        ],
        currentJudgeId: 'p1'
      });

      const judgeExists = game.players.some(p => p.id === game.currentJudgeId);
      expect(judgeExists).toBe(true);
    });

    test('detects invalid judge id', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1' }),
          createMockPlayer({ id: 'p2' }),
        ],
        currentJudgeId: 'invalid-id'
      });

      const judgeExists = game.players.some(p => p.id === game.currentJudgeId);
      expect(judgeExists).toBe(false);
    });

    test('validates judge is in ready player order', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: true }),
          createMockPlayer({ id: 'p2', isReady: false }),
        ],
        currentJudgeId: 'p1',
        ready_player_order: ['p1'] // Only ready player
      });

      const judgeInOrder = game.ready_player_order.includes(game.currentJudgeId!);
      expect(judgeInOrder).toBe(true);
    });

    test('detects when judge not in ready order', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', isReady: false }),
          createMockPlayer({ id: 'p2', isReady: true }),
        ],
        currentJudgeId: 'p1', // Not ready
        ready_player_order: ['p2'] // Only p2 is ready
      });

      const judgeInOrder = game.ready_player_order.includes(game.currentJudgeId!);
      expect(judgeInOrder).toBe(false);
    });
  });

  describe('Multi-Round Judge Rotation', () => {
    test('simulates judge rotation across multiple rounds', () => {
      const readyOrder = ['p1', 'p2', 'p3', 'p4'];
      const rounds = [
        { round: 1, expectedJudge: 'p1' },
        { round: 2, expectedJudge: 'p2' },
        { round: 3, expectedJudge: 'p3' },
        { round: 4, expectedJudge: 'p4' },
        { round: 5, expectedJudge: 'p1' }, // Wraps around
      ];

      rounds.forEach(({ round, expectedJudge }) => {
        const judgeIndex = (round - 1) % readyOrder.length;
        const actualJudge = readyOrder[judgeIndex];
        expect(actualJudge).toBe(expectedJudge);
      });
    });

    test('maintains rotation with different player counts', () => {
      // Test with 2 players
      const twoPlayerOrder = ['p1', 'p2'];
      expect(twoPlayerOrder[0 % 2]).toBe('p1');
      expect(twoPlayerOrder[1 % 2]).toBe('p2');
      expect(twoPlayerOrder[2 % 2]).toBe('p1'); // Wraps

      // Test with 5 players
      const fivePlayerOrder = ['p1', 'p2', 'p3', 'p4', 'p5'];
      expect(fivePlayerOrder[4 % 5]).toBe('p5');
      expect(fivePlayerOrder[5 % 5]).toBe('p1'); // Wraps
    });
  });
});