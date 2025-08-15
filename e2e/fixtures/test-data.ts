export const TEST_PLAYERS = [
  'Alice_Test',
  'Bob_Test', 
  'Charlie_Test',
  'Diana_Test',
  'Eve_Test',
] as const;

export const TEST_SCENARIOS = [
  {
    title: 'The Coffee Shop',
    description: 'A cozy coffee shop scenario for testing',
    situation: 'You are in a small coffee shop...',
  },
  {
    title: 'The Office Meeting',
    description: 'An office meeting scenario for testing',
    situation: 'You are in an important meeting...',
  },
] as const;

export const TEST_GAME_CONFIG = {
  minPlayers: 2,
  maxPlayers: 8,
  defaultPlayerCount: 3,
  timeouts: {
    pageLoad: 10000,
    gameStart: 15000,
    playerAction: 5000,
    reset: 10000,
  },
} as const;