
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  return gameState;
}

export function initializeInMemoryGame(): GameState {
  const scenarios = generateScenarios();
  const initialCategories = Object.keys(scenarios);
  // Ensure there's at least one category and one scenario for safety, though data.ts should provide.
  const defaultCategory = initialCategories.length > 0 ? initialCategories[0] : "Default Category";
  const defaultScenario = scenarios[defaultCategory]?.length > 0 ? scenarios[defaultCategory][0] : { id: 'default-s1', category: defaultCategory, text: 'Default scenario text.'};

  gameState = {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: null, // Judge will select category, then scenario is drawn
    gamePhase: 'welcome', // Or 'waiting_for_players' if reset is from setup
    submissions: [],
    categories: initialCategories,
    scenariosByCategory: scenarios,
    responseCardsDeck: getShuffledDeck(RESPONSE_CARDS_DATA),
    lastWinner: undefined,
    winningPlayerId: null,
  };
  // If called from reset on setup page, immediately go to waiting_for_players
  if (typeof window !== 'undefined' && window.location.search.includes('step=setup')) {
    gameState.gamePhase = 'waiting_for_players';
  }
  return gameState;
}

export function addPlayerToGame(name: string, avatar: string): Player | null {
  if (!gameState || gameState.gamePhase === 'welcome') { // Initialize if null or coming from initial welcome
    initializeInMemoryGame();
  }
  if (!gameState) {
    return null; 
  }

  if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    // Player already exists, return existing player
    return gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const hand: string[] = [];
  for (let i = 0; i < CARDS_PER_HAND; i++) {
    if (gameState.responseCardsDeck.length > 0) {
      hand.push(gameState.responseCardsDeck.pop()!);
    } else {
      // Optional: Add a fallback/dummy card if deck is empty, or handle differently
      hand.push(`Fallback Card ${i + 1} (Deck Empty)`);
    }
  }

  const newPlayer: Player = { id: newPlayerId, name, avatar, score: 0, isJudge: false, hand };
  gameState.players.push(newPlayer);

  if (gameState.gamePhase === 'welcome' || gameState.gamePhase === 'waiting_for_players') {
    gameState.gamePhase = 'waiting_for_players';
  }
  
  return newPlayer;
}

export function startGame(): GameState | null {
  if (!gameState || gameState.players.length < 1) { // Allow starting with 1 player for testing judge view
    if (!gameState) initializeInMemoryGame();
    if (!gameState || gameState.players.length < 1) return gameState; // Still not enough or failed init
  }

  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
  gameState.players.forEach(p => p.isJudge = false); // Reset all judge statuses

  if (gameState.players.length > 0) {
    const currentJudgeIndex = gameState.currentJudgeId ? gameState.players.findIndex(p => p.id === gameState.currentJudgeId) : -1;
    const nextJudgeIndex = (currentJudgeIndex + 1) % gameState.players.length;
    gameState.players[nextJudgeIndex].isJudge = true;
    gameState.currentJudgeId = gameState.players[nextJudgeIndex].id;
  } else {
    gameState.currentJudgeId = null; // No judge if no players
  }

  gameState.submissions = [];
  gameState.currentScenario = null; // Judge will select category and then a scenario is drawn
  gameState.lastWinner = undefined;
  gameState.winningPlayerId = null;

  // Refill hands to CARDS_PER_HAND for all players
  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    if (cardsNeeded > 0) {
      for (let i = 0; i < cardsNeeded; i++) {
        if (gameState!.responseCardsDeck.length > 0) {
          player.hand.push(gameState!.responseCardsDeck.pop()!);
        } else {
          player.hand.push(`Refill Card ${i + 1} (Deck Empty)`);
        }
      }
    }
  });

  return gameState;
}

export function selectCategoryAndDrawScenario(categoryId: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'category_selection' || !gameState.currentJudgeId) {
    return null;
  }
  const categoryScenarios = gameState.scenariosByCategory[categoryId];
  if (!categoryScenarios || categoryScenarios.length === 0) {
     // Fallback to the first available scenario from any category if selected one is empty
     const firstPopulatedCategoryKey = Object.keys(gameState.scenariosByCategory).find(key => gameState.scenariosByCategory[key].length > 0);
     if (firstPopulatedCategoryKey && gameState.scenariosByCategory[firstPopulatedCategoryKey].length > 0) {
         gameState.currentScenario = gameState.scenariosByCategory[firstPopulatedCategoryKey][Math.floor(Math.random() * gameState.scenariosByCategory[firstPopulatedCategoryKey].length)];
     } else {
         // Ultimate fallback if all scenario data is somehow missing
         gameState.currentScenario = { id: 'fallback-error-1', category: "Error", text: "Error: No scenarios available." };
     }
  } else {
    // Pick a random scenario from the selected category
    gameState.currentScenario = categoryScenarios[Math.floor(Math.random() * categoryScenarios.length)];
  }
  
  gameState.gamePhase = 'player_submission';
  gameState.submissions = []; // Clear previous submissions
  return gameState;
}

export function submitPlayerResponse(playerId: string, cardText: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'player_submission' || !gameState.currentScenario) {
    return null;
  }
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.isJudge) {
    return null; // Judges don't submit, or player not found
  }

  // Prevent duplicate submissions from the same player in a round
  if (gameState.submissions.find(s => s.playerId === playerId)) {
    return null; 
  }

  gameState.submissions.push({ playerId, cardText });
  
  // Remove submitted card from hand and draw a new one
  player.hand = player.hand.filter(card => card !== cardText);
  if (gameState.responseCardsDeck.length > 0) {
    player.hand.push(gameState.responseCardsDeck.pop()!);
  } else {
    player.hand.push("Fallback Card (Deck Empty)");
  }

  const nonJudgePlayers = gameState.players.filter(p => !p.isJudge);
  // In a 1-player game (for testing), nonJudgePlayers will be 0.
  // In a 2-player game, nonJudgePlayers will be 1.
  if (gameState.submissions.length >= nonJudgePlayers.length) {
    gameState.gamePhase = 'judging';
  }
  return gameState;
}

export function selectWinningSubmission(cardText: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'judging' || !gameState.currentJudgeId) {
    return null;
  }
  const winningSubmission = gameState.submissions.find(s => s.cardText === cardText);
  
  if (!winningSubmission && gameState.submissions.length > 0) {
    // If exact card text not found (e.g. if multiple identical cards somehow submitted, or slight mismatch),
    // and submissions exist, this indicates an issue or need for more robust matching.
    // For now, if there's only one submission, assume it's the winner.
    // This is a fragile fallback and should be improved if card texts are not guaranteed unique.
    if (gameState.submissions.length === 1) {
        // Potentially pick the only submission if exact match failed but one exists.
        // However, this path might be problematic if submissions can actually be empty here.
        // For now, let's rely on exact match. If it fails, it's an issue.
    }
    // If no exact match and multiple submissions, this is an error state for now.
    if(!winningSubmission) return null;
  } else if (!winningSubmission && gameState.submissions.length === 0) {
    return null; // No submissions to choose from
  }
  
  if (!winningSubmission) return null; // Should be caught above, but as a safeguard.


  const winningPlayer = gameState.players.find(p => p.id === winningSubmission.playerId);
  if (!winningPlayer) {
    return null; // Should not happen if submission is valid
  }

  winningPlayer.score += 1;
  gameState.lastWinner = { player: { ...winningPlayer }, cardText: winningSubmission.cardText }; // Store a copy
  
  if (winningPlayer.score >= POINTS_TO_WIN) {
    gameState.winningPlayerId = winningPlayer.id;
    gameState.gamePhase = 'game_over';
  } else {
    gameState.gamePhase = 'winner_announcement';
  }
  return gameState;
}

export function advanceToNextRound(): GameState | null {
  if (!gameState || (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
    return null;
  }

  if (gameState.gamePhase === 'game_over') {
    // Reset the game for a new session
    return initializeInMemoryGame(); 
  }

  // Rotate Judge
  const currentJudgeIndex = gameState.players.findIndex(p => p.id === gameState.currentJudgeId);
  if (gameState.players.length > 0) { // Ensure there are players before trying to rotate judge
    if (gameState.players[currentJudgeIndex]) { // Check if current judge exists
      gameState.players[currentJudgeIndex].isJudge = false;
    }
    
    const nextJudgeIndex = (currentJudgeIndex + 1) % gameState.players.length;
    gameState.players[nextJudgeIndex].isJudge = true;
    gameState.currentJudgeId = gameState.players[nextJudgeIndex].id;
  } else {
      gameState.currentJudgeId = null; // No judge if no players
  }

  // Refill hands for all players
  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    if (cardsNeeded > 0) {
      for (let i = 0; i < cardsNeeded; i++) {
        if (gameState!.responseCardsDeck.length > 0) {
          player.hand.push(gameState!.responseCardsDeck.pop()!);
        } else {
          player.hand.push(`Refill Card ${i + 1} (Deck Empty)`);
        }
      }
    }
  });

  gameState.currentRound += 1;
  gameState.currentScenario = null; // New scenario will be drawn after category selection
  gameState.submissions = [];
  gameState.gamePhase = 'category_selection';
  gameState.lastWinner = undefined;
  // winningPlayerId is for game_over, not round winner, so it's not reset here
  return gameState;
}

// Utility to update the entire game state, e.g., from a loaded state. Use with caution.
export function updateGame(updatedState: GameState): void {
  gameState = updatedState;
}

    