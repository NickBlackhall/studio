import { 
  PlayerClientState, 
  GameClientState, 
  ScenarioClientState, 
  PlayerHandCard,
  GamePhaseClientState,
  TransitionState,
  CARDS_PER_HAND 
} from '../../src/lib/types';

export function createMockPlayer(overrides: Partial<PlayerClientState> = {}): PlayerClientState {
  const defaultPlayer: PlayerClientState = {
    id: `player-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Player',
    avatar: '🎭',
    score: 0,
    isJudge: false,
    hand: createMockHand(),
    isReady: false,
  };

  return { ...defaultPlayer, ...overrides };
}

export function createMockHand(cardCount: number = CARDS_PER_HAND): PlayerHandCard[] {
  return Array.from({ length: cardCount }, (_, index) => ({
    id: `card-${index}-${Math.random().toString(36).substr(2, 9)}`,
    text: `Test Card ${index + 1}`,
    isNew: false,
    isCustom: false,
  }));
}

export function createMockScenario(overrides: Partial<ScenarioClientState> = {}): ScenarioClientState {
  const defaultScenario: ScenarioClientState = {
    id: `scenario-${Math.random().toString(36).substr(2, 9)}`,
    category: 'Test Category',
    text: 'Test scenario text',
  };

  return { ...defaultScenario, ...overrides };
}

export function createMockGame(overrides: Partial<GameClientState> = {}): GameClientState {
  const player1 = createMockPlayer({ id: 'player-1', name: 'Player 1' });
  const player2 = createMockPlayer({ id: 'player-2', name: 'Player 2' });
  
  const defaultGame: GameClientState = {
    gameId: `game-${Math.random().toString(36).substr(2, 9)}`,
    players: [player1, player2],
    currentRound: 1,
    currentJudgeId: player1.id,
    currentScenario: null,
    gamePhase: 'lobby' as GamePhaseClientState,
    submissions: [],
    categories: ['Test Category 1', 'Test Category 2', 'Test Category 3'],
    ready_player_order: [],
    transitionState: 'idle' as TransitionState,
  };

  return { ...defaultGame, ...overrides };
}

export function createMockGameInPhase(
  phase: GamePhaseClientState, 
  playerCount: number = 2,
  extraOptions: Partial<GameClientState> = {}
): GameClientState {
  const players = Array.from({ length: playerCount }, (_, index) => 
    createMockPlayer({ 
      id: `player-${index + 1}`, 
      name: `Player ${index + 1}`,
      isReady: true 
    })
  );

  const baseGame = createMockGame({
    players,
    gamePhase: phase,
    currentJudgeId: players[0]?.id || null,
    ...extraOptions
  });

  // Set up game state based on phase
  switch (phase) {
    case 'category_selection':
      return {
        ...baseGame,
        currentScenario: null,
        submissions: [],
      };
      
    case 'player_submission':
      return {
        ...baseGame,
        currentScenario: createMockScenario(),
        submissions: [],
      };
      
    case 'judging':
      return {
        ...baseGame,
        currentScenario: createMockScenario(),
        submissions: players.slice(1).map(player => ({
          playerId: player.id,
          cardId: player.hand[0]?.id || 'card-1',
          cardText: player.hand[0]?.text || 'Test submission',
        })),
      };
      
    case 'winner_announcement':
      const winner = players[1];
      return {
        ...baseGame,
        currentScenario: createMockScenario(),
        submissions: [],
        lastWinner: {
          player: winner,
          cardText: 'Winning card text',
        },
      };
      
    default:
      return baseGame;
  }
}