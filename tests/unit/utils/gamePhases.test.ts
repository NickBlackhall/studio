import { createMockGameInPhase } from '../../fixtures/mockData';
import { GamePhaseClientState, ACTIVE_PLAYING_PHASES } from '../../../src/lib/types';

describe('Game Phase Logic', () => {
  describe('Phase Transitions', () => {
    test('lobby phase has no scenario or submissions', () => {
      const game = createMockGameInPhase('lobby');
      
      expect(game.gamePhase).toBe('lobby');
      expect(game.currentScenario).toBeNull();
      expect(game.submissions).toHaveLength(0);
    });

    test('category_selection phase clears previous submissions', () => {
      const game = createMockGameInPhase('category_selection');
      
      expect(game.gamePhase).toBe('category_selection');
      expect(game.currentScenario).toBeNull();
      expect(game.submissions).toHaveLength(0);
    });

    test('player_submission phase has scenario but no submissions yet', () => {
      const game = createMockGameInPhase('player_submission');
      
      expect(game.gamePhase).toBe('player_submission');
      expect(game.currentScenario).not.toBeNull();
      expect(game.submissions).toHaveLength(0);
    });

    test('judging phase has scenario and submissions from non-judge players', () => {
      const game = createMockGameInPhase('judging', 4); // 4 players = 3 submissions
      
      expect(game.gamePhase).toBe('judging');
      expect(game.currentScenario).not.toBeNull();
      expect(game.submissions).toHaveLength(3); // All except judge
    });

    test('winner_announcement phase has lastWinner data', () => {
      const game = createMockGameInPhase('winner_announcement');
      
      expect(game.gamePhase).toBe('winner_announcement');
      expect(game.lastWinner).toBeDefined();
      expect(game.lastWinner?.player).toBeDefined();
      expect(game.lastWinner?.cardText).toBeDefined();
    });
  });

  describe('Active Playing Phases', () => {
    test('lobby is not an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).not.toContain('lobby');
    });

    test('game_over is not an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).not.toContain('game_over');
    });

    test('winner_announcement is not an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).not.toContain('winner_announcement');
    });

    test('category_selection is an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).toContain('category_selection');
    });

    test('player_submission is an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).toContain('player_submission');
    });

    test('judging is an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).toContain('judging');
    });

    test('judge_approval_pending is an active playing phase', () => {
      expect(ACTIVE_PLAYING_PHASES).toContain('judge_approval_pending');
    });
  });

  describe('Phase Validation', () => {
    test('validates if phase is active playing phase', () => {
      const isActivePlaying = (phase: GamePhaseClientState): boolean => {
        return ACTIVE_PLAYING_PHASES.includes(phase);
      };

      expect(isActivePlaying('lobby')).toBe(false);
      expect(isActivePlaying('category_selection')).toBe(true);
      expect(isActivePlaying('player_submission')).toBe(true);
      expect(isActivePlaying('judging')).toBe(true);
      expect(isActivePlaying('winner_announcement')).toBe(false);
      expect(isActivePlaying('game_over')).toBe(false);
    });

    test('validates if game can accept player actions', () => {
      const canPlayerAct = (phase: GamePhaseClientState): boolean => {
        return ['category_selection', 'player_submission'].includes(phase);
      };

      expect(canPlayerAct('lobby')).toBe(false);
      expect(canPlayerAct('category_selection')).toBe(true);
      expect(canPlayerAct('player_submission')).toBe(true);
      expect(canPlayerAct('judging')).toBe(false);
      expect(canPlayerAct('winner_announcement')).toBe(false);
    });

    test('validates if judge can act', () => {
      const canJudgeAct = (phase: GamePhaseClientState): boolean => {
        return ['judging', 'judge_approval_pending'].includes(phase);
      };

      expect(canJudgeAct('lobby')).toBe(false);
      expect(canJudgeAct('category_selection')).toBe(false);
      expect(canJudgeAct('player_submission')).toBe(false);
      expect(canJudgeAct('judging')).toBe(true);
      expect(canJudgeAct('judge_approval_pending')).toBe(true);
      expect(canJudgeAct('winner_announcement')).toBe(false);
    });
  });

  describe('Submission Logic', () => {
    test('judge does not submit in judging phase', () => {
      const game = createMockGameInPhase('judging', 3);
      const judgeId = game.currentJudgeId;
      
      const judgeSubmission = game.submissions.find(s => s.playerId === judgeId);
      expect(judgeSubmission).toBeUndefined();
    });

    test('all non-judge players have submissions in judging phase', () => {
      const game = createMockGameInPhase('judging', 4);
      const nonJudgePlayers = game.players.filter(p => p.id !== game.currentJudgeId);
      
      expect(game.submissions).toHaveLength(nonJudgePlayers.length);
      
      nonJudgePlayers.forEach(player => {
        const hasSubmission = game.submissions.some(s => s.playerId === player.id);
        expect(hasSubmission).toBe(true);
      });
    });
  });
});