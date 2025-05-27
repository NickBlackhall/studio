
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  return gameState;
}

// Radically simplified initializeInMemoryGame for server stability testing.
export function initializeInMemoryGame(): GameState {
  const minimalDeck = ["Card A", "Card B", "Card C", "Card D", "Card E", "Card F", "Card G"];
  const minimalScenarios: Record<string, Scenario[]> = {
    "Simple Category": [
      { id: 'simple-1', category: "Simple Category", text: "A very simple scenario." }
    ]
  };
  gameState = {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: minimalScenarios["Simple Category"][0], // Assign a default scenario
    gamePhase: 'welcome',
    submissions: [],
    categories: ["Simple Category"],
    scenariosByCategory: minimalScenarios,
    responseCardsDeck: [...minimalDeck], 
    lastWinner: undefined,
    winningPlayerId: null,
  };
  return gameState;
}

export function addPlayerToGame(name: string, avatar: string): Player | null {
  if (!gameState) {
    initializeInMemoryGame(); 
  }
  if (!gameState) {
    // This case should ideally not be reached if initializeInMemoryGame works
    return null; 
  }

  if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    return gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const hand: string[] = [];
  // Ensure there are enough cards in the simplified deck for a hand
  const cardsToDeal = Math.min(CARDS_PER_HAND, gameState.responseCardsDeck.length);
  for (let i = 0; i < cardsToDeal; i++) {
    hand.push(gameState.responseCardsDeck.pop()!);
  }
  // If deck ran out, add some dummy cards to hand to meet CARDS_PER_HAND
  while(hand.length < CARDS_PER_HAND) {
    hand.push(`Dummy Card ${hand.length + 1}`);
  }


  const newPlayer: Player = { id: newPlayerId, name, avatar, score: 0, isJudge: false, hand };
  gameState.players.push(newPlayer);
  if (gameState.gamePhase === 'welcome' || gameState.players.length === 1) {
    gameState.gamePhase = 'waiting_for_players';
  }
  return newPlayer;
}

export function startGame(): GameState | null {
  if (!gameState || gameState.players.length < 1) { 
    if (!gameState) {
      initializeInMemoryGame();
      if (!gameState) return null; 
    }
    if (gameState.players.length < 1) return gameState;
  }
  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
  gameState.players.forEach(p => p.isJudge = false);
  if (gameState.players.length > 0) { 
    gameState.players[0].isJudge = true;
    gameState.currentJudgeId = gameState.players[0].id;
  } else {
    gameState.currentJudgeId = null; 
  }
  gameState.submissions = [];
  gameState.currentScenario = null; // Judge will select category and draw new scenario
  return gameState;
}

export function selectCategoryAndDrawScenario(categoryId: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'category_selection' || !gameState.currentJudgeId) {
    return null;
  }
  const categoryScenarios = gameState.scenariosByCategory[categoryId];
  if (!categoryScenarios || categoryScenarios.length === 0) {
     // Fallback to the first available scenario if selected category is empty or invalid
     const firstCategoryKey = Object.keys(gameState.scenariosByCategory)[0];
     if (firstCategoryKey && gameState.scenariosByCategory[firstCategoryKey].length > 0) {
         gameState.currentScenario = gameState.scenariosByCategory[firstCategoryKey][0];
     } else {
         // Ultimate fallback if all scenario data is somehow missing
         gameState.currentScenario = { id: 'fallback-error-1', category: "Error", text: "Error: No scenarios available." };
     }
  } else {
    gameState.currentScenario = categoryScenarios[0]; // Pick the first one for simplicity
  }
  
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
    return null; 
  }

  if (gameState.submissions.find(s => s.playerId === playerId)) {
    return null; 
  }

  gameState.submissions.push({ playerId, cardText });
  
  player.hand = player.hand.filter(card => card !== cardText);
  if (gameState.responseCardsDeck.length > 0) {
    player.hand.push(gameState.responseCardsDeck.pop()!);
  } else {
    player.hand.push("Fallback Card (Deck Empty)"); // Add a fallback if deck is empty
  }


  const nonJudgePlayers = gameState.players.filter(p => !p.isJudge);
  // Allow progression with 0 non-judge players if game started with 1 player (who is judge)
  if (gameState.submissions.length === nonJudgePlayers.length || nonJudgePlayers.length === 0) {
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
     // If the exact card text isn't found (e.g. if multiple identical cards were somehow submitted),
     // and there's only one submission, pick that one. Otherwise, it's an issue.
     if (gameState.submissions.length === 1) {
        // This path might not be robust if submissions can be empty.
     } else {
        return null; 
     }
  }

  const actualWinningSubmission = winningSubmission || gameState.submissions[0]; // Fallback if needed
  if (!actualWinningSubmission) return null;


  const winningPlayer = gameState.players.find(p => p.id === actualWinningSubmission.playerId);
  if (!winningPlayer) {
    return null; 
  }

  winningPlayer.score += 1;
  gameState.lastWinner = { player: { ...winningPlayer }, cardText: actualWinningSubmission.cardText }; 
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
    return initializeInMemoryGame(); 
  }

  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    if (cardsNeeded > 0) {
      for (let i = 0; i < cardsNeeded; i++) {
        if (gameState!.responseCardsDeck.length > 0) {
          player.hand.push(gameState!.responseCardsDeck.pop()!);
        } else {
          player.hand.push(`Refill Card ${i + 1}`); // Fallback card
        }
      }
    }
  });

  const currentJudgeIndex = gameState.players.findIndex(p => p.id === gameState!.currentJudgeId);
  if (gameState.players.length > 0) { // Ensure there are players before trying to rotate judge
    if (gameState.players[currentJudgeIndex]) { 
      gameState.players[currentJudgeIndex].isJudge = false;
    }
    
    const nextJudgeIndex = (currentJudgeIndex + 1) % gameState.players.length;
    gameState.players[nextJudgeIndex].isJudge = true;
    gameState.currentJudgeId = gameState.players[nextJudgeIndex].id;
  } else {
      gameState.currentJudgeId = null; // No judge if no players
  }


  gameState.currentRound += 1;
  gameState.currentScenario = null;
  gameState.submissions = [];
  gameState.gamePhase = 'category_selection';
  gameState.lastWinner = undefined;
  return gameState;
}

export function updateGame(updatedState: GameState): void {
  gameState = updatedState;
}
