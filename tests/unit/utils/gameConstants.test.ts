import { 
  POINTS_TO_WIN, 
  CARDS_PER_HAND, 
  MIN_PLAYERS_TO_START,
  ACTIVE_PLAYING_PHASES 
} from '../../../src/lib/types';

describe('Game Constants', () => {
  test('POINTS_TO_WIN should be 3', () => {
    expect(POINTS_TO_WIN).toBe(3);
  });

  test('CARDS_PER_HAND should be 5', () => {
    expect(CARDS_PER_HAND).toBe(5);
  });

  test('MIN_PLAYERS_TO_START should be 2', () => {
    expect(MIN_PLAYERS_TO_START).toBe(2);
  });

  test('ACTIVE_PLAYING_PHASES should include correct phases', () => {
    expect(ACTIVE_PLAYING_PHASES).toEqual([
      'category_selection',
      'player_submission', 
      'judging',
      'judge_approval_pending'
    ]);
  });

  test('ACTIVE_PLAYING_PHASES should not include lobby or game_over', () => {
    expect(ACTIVE_PLAYING_PHASES).not.toContain('lobby');
    expect(ACTIVE_PLAYING_PHASES).not.toContain('game_over');
    expect(ACTIVE_PLAYING_PHASES).not.toContain('winner_announcement');
  });
});