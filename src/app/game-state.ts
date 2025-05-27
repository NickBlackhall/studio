
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

// This is a server-side in-memory store. Not suitable for production.
let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  return gameState;
}

export function initializeInMemoryGame(): GameState {
  const initialDeck = getShuffledDeck(RESPONSE_CARDS_DATA);
  gameState = {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: null,
    gamePhase: 'welcome',
    submissions: [],
    categories: CATEGORIES,
    scenariosByCategory: generateScenarios(),
    responseCardsDeck: initialDeck,
    lastWinner: undefined,
    winningPlayerId: null,
  };
  return gameState;
}

export function addPlayerToGame(name: string, avatar: string): Player | null {
  if (!gameState) {
    initializeInMemoryGame();
  }
  if (gameState!.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    // Player with this name already exists
    // For now, let's just return null. In a real app, you might allow rejoining or throw an error.
    return null; 
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Deal initial hand
  const hand: string[] = [];
  if (gameState!.responseCardsDeck.length < CARDS_PER_HAND) {
    // Not enough cards to deal a full hand - replenish or end game (simplified for now)
    console.warn("Not enough cards in deck to deal a full hand!");
    // Replenish deck for simplicity if it's critically low
    if (gameState!.responseCardsDeck.length < CARDS_PER_HAND * (gameState!.players.length + 1)) {
       gameState!.responseCardsDeck.push(...getShuffledDeck(RESPONSE_CARDS_DATA));
    }
  }
  for (let i = 0; i < CARDS_PER_HAND && gameState!.responseCardsDeck.length > 0; i++) {
    hand.push(gameState!.responseCardsDeck.pop()!);
  }

  const newPlayer: Player = { id: newPlayerId, name, avatar, score: 0, isJudge: false, hand };
  gameState!.players.push(newPlayer);
  if (gameState!.gamePhase === 'welcome') {
    gameState!.gamePhase = 'waiting_for_players';
  }
  return newPlayer;
}

export function startGame(): GameState | null {
  if (!gameState || gameState.players.length < 1) { // Allow 1 for testing, ideally 2+
    return null;
  }
  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
  // Assign first judge
  gameState.players.forEach(p => p.isJudge = false);
  gameState.players[0].isJudge = true;
  gameState.currentJudgeId = gameState.players[0].id;
  gameState.submissions = [];
  gameState.currentScenario = null;
  return gameState;
}

export function selectCategoryAndDrawScenario(categoryId: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'category_selection' || !gameState.currentJudgeId) {
    return null;
  }
  const categoryScenarios = gameState.scenariosByCategory[categoryId];
  if (!categoryScenarios || categoryScenarios.length === 0) {
    return null; // Category not found or empty
  }
  const randomIndex = Math.floor(Math.random() * categoryScenarios.length);
  gameState.currentScenario = categoryScenarios[randomIndex];
  gameState.gamePhase = 'player_submission';
  gameState.submissions = [];
  return gameState;
}

export function submitPlayerResponse(playerId: string, cardText: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'player_submission' || !gameState.currentScenario) {
    return null;
  }
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.isJudge) {
    return null; // Player not found or is the judge
  }

  if (gameState.submissions.find(s => s.playerId === playerId)) {
    return null; // Player already submitted for this round
  }

  gameState.submissions.push({ playerId, cardText });
  
  // Remove submitted card from player's hand
  player.hand = player.hand.filter(card => card !== cardText);

  // Check if all non-judge players have submitted
  const nonJudgePlayers = gameState.players.filter(p => !p.isJudge);
  if (gameState.submissions.length === nonJudgePlayers.length) {
    gameState.gamePhase = 'judging';
  }
  return gameState;
}

export function selectWinningSubmission(cardText: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'judging' || !gameState.currentJudgeId) {
    return null;
  }
  const winningSubmission = gameState.submissions.find(s => s.cardText === cardText);
  if (!winningSubmission) {
    return null; // Submitted card not found
  }

  const winningPlayer = gameState.players.find(p => p.id === winningSubmission.playerId);
  if (!winningPlayer) {
    return null; // Should not happen
  }

  winningPlayer.score += 1;
  gameState.lastWinner = { player: { ...winningPlayer }, cardText: winningSubmission.cardText }; // Store a copy
  gameState.gamePhase = 'winner_announcement';

  if (winningPlayer.score >= POINTS_TO_WIN) {
    gameState.winningPlayerId = winningPlayer.id;
    gameState.gamePhase = 'game_over';
  }

  return gameState;
}

export function advanceToNextRound(): GameState | null {
  if (!gameState || (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
    return null;
  }

  if (gameState.gamePhase === 'game_over') {
    // Could reset to welcome or show a final game over screen
    // For now, let's re-initialize for a new game if they try to advance from game_over
    return initializeInMemoryGame();
  }

  // Replenish hands for all players
  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    for (let i = 0; i < cardsNeeded && gameState!.responseCardsDeck.length > 0; i++) {
      player.hand.push(gameState!.responseCardsDeck.pop()!);
    }
    // If deck runs out during replenishment, it's a problem.
    // Consider reshuffling used cards or having a very large deck.
     if (gameState!.responseCardsDeck.length < CARDS_PER_HAND * gameState!.players.length) {
       gameState!.responseCardsDeck.push(...getShuffledDeck(RESPONSE_CARDS_DATA)); // Simple replenish
    }
  });


  // Rotate judge
  const currentJudgeIndex = gameState.players.findIndex(p => p.id === gameState!.currentJudgeId);
  gameState.players[currentJudgeIndex].isJudge = false;
  const nextJudgeIndex = (currentJudgeIndex + 1) % gameState.players.length;
  gameState.players[nextJudgeIndex].isJudge = true;
  gameState.currentJudgeId = gameState.players[nextJudgeIndex].id;

  gameState.currentRound += 1;
  gameState.currentScenario = null;
  gameState.submissions = [];
  gameState.gamePhase = 'category_selection';
  gameState.lastWinner = undefined;

  return gameState;
}

// Function to update game state, e.g., after a player leaves (not fully implemented)
export function updateGame(updatedState: GameState): void {
  gameState = updatedState;
}
