import { createMockGame, createMockPlayer } from '../../fixtures/mockData';
import { POINTS_TO_WIN } from '../../../src/lib/types';

describe('Scoring and Win Conditions', () => {
  describe('Point Scoring', () => {
    test('players start with zero points', () => {
      const player = createMockPlayer();
      expect(player.score).toBe(0);
    });

    test('tracks individual player scores', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: 2 }),
          createMockPlayer({ id: 'p2', score: 1 }),
          createMockPlayer({ id: 'p3', score: 0 }),
        ]
      });

      expect(game.players[0].score).toBe(2);
      expect(game.players[1].score).toBe(1);
      expect(game.players[2].score).toBe(0);
    });

    test('calculates score increment correctly', () => {
      const player = createMockPlayer({ score: 1 });
      const newScore = player.score + 1;
      expect(newScore).toBe(2);
    });
  });

  describe('Win Condition Logic', () => {
    test('identifies winning player when reaching points threshold', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: POINTS_TO_WIN }),
          createMockPlayer({ id: 'p2', score: 1 }),
        ]
      });

      const winner = game.players.find(p => p.score >= POINTS_TO_WIN);
      expect(winner?.id).toBe('p1');
    });

    test('no winner when no player reaches threshold', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: POINTS_TO_WIN - 1 }),
          createMockPlayer({ id: 'p2', score: 1 }),
        ]
      });

      const winner = game.players.find(p => p.score >= POINTS_TO_WIN);
      expect(winner).toBeUndefined();
    });

    test('handles multiple players at win threshold', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: POINTS_TO_WIN }),
          createMockPlayer({ id: 'p2', score: POINTS_TO_WIN }),
          createMockPlayer({ id: 'p3', score: 1 }),
        ]
      });

      const winners = game.players.filter(p => p.score >= POINTS_TO_WIN);
      expect(winners).toHaveLength(2);
      expect(winners.map(w => w.id)).toEqual(['p1', 'p2']);
    });

    test('validates game can continue when no winner', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ score: 2 }),
          createMockPlayer({ score: 1 }),
        ]
      });

      const gameHasWinner = game.players.some(p => p.score >= POINTS_TO_WIN);
      const canContinue = !gameHasWinner;
      expect(canContinue).toBe(true);
    });

    test('validates game should end when winner exists', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ score: POINTS_TO_WIN }),
          createMockPlayer({ score: 1 }),
        ]
      });

      const gameHasWinner = game.players.some(p => p.score >= POINTS_TO_WIN);
      const shouldEnd = gameHasWinner;
      expect(shouldEnd).toBe(true);
    });
  });

  describe('Leaderboard Logic', () => {
    test('sorts players by score descending', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: 1, name: 'Player 1' }),
          createMockPlayer({ id: 'p2', score: 3, name: 'Player 2' }),
          createMockPlayer({ id: 'p3', score: 2, name: 'Player 3' }),
        ]
      });

      const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
      expect(sortedPlayers[0].id).toBe('p2'); // Highest score
      expect(sortedPlayers[1].id).toBe('p3'); // Middle score  
      expect(sortedPlayers[2].id).toBe('p1'); // Lowest score
    });

    test('handles tied scores in leaderboard', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: 2 }),
          createMockPlayer({ id: 'p2', score: 2 }),
          createMockPlayer({ id: 'p3', score: 1 }),
        ]
      });

      const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
      
      // First two players tied for highest score
      expect(sortedPlayers[0].score).toBe(2);
      expect(sortedPlayers[1].score).toBe(2);
      expect(sortedPlayers[2].score).toBe(1);
    });

    test('finds highest scoring player', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ id: 'p1', score: 1 }),
          createMockPlayer({ id: 'p2', score: 3 }),
          createMockPlayer({ id: 'p3', score: 2 }),
        ]
      });

      const highestScorer = game.players.reduce((max, player) => 
        player.score > max.score ? player : max
      );
      
      expect(highestScorer.id).toBe('p2');
      expect(highestScorer.score).toBe(3);
    });
  });

  describe('Round-by-Round Scoring', () => {
    test('simulates score progression over rounds', () => {
      let player1Score = 0;
      let player2Score = 0;

      // Round 1: Player 1 wins
      player1Score += 1;
      expect(player1Score).toBe(1);
      expect(player2Score).toBe(0);

      // Round 2: Player 2 wins  
      player2Score += 1;
      expect(player1Score).toBe(1);
      expect(player2Score).toBe(1);

      // Round 3: Player 1 wins again
      player1Score += 1;
      expect(player1Score).toBe(2);
      expect(player2Score).toBe(1);

      // Round 4: Player 1 wins and reaches threshold
      player1Score += 1;
      expect(player1Score).toBe(POINTS_TO_WIN);
      expect(player1Score >= POINTS_TO_WIN).toBe(true);
    });

    test('validates win condition check after each round', () => {
      const checkForWinner = (scores: number[]): boolean => {
        return scores.some(score => score >= POINTS_TO_WIN);
      };

      expect(checkForWinner([1, 1, 0])).toBe(false); // No winner yet
      expect(checkForWinner([2, 1, 0])).toBe(false); // No winner yet
      expect(checkForWinner([3, 1, 0])).toBe(true);  // Winner found
    });
  });
});