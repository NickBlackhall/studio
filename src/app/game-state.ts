
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

// This is a server-side in-memory store. Not suitable for production.
let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  return gameState;
}

// TEMPORARILY SIMPLIFIED FOR DEBUGGING TIMEOUTS
export function initializeInMemoryGame(): GameState {
  console.log("DEBUG: Using simplified initializeInMemoryGame");
  const minimalDeck = ["Card 1", "Card 2", "Card 3", "Card 4", "Card 5", "Card 6", "Card 7", "Card 8", "Card 9", "Card 10"];
  const minimalScenarios: Record<string, Scenario[]> = {
    "Awkward Situations": [
      { id: 'awk-1', category: "Awkward Situations", text: "Minimal scenario 1" }
    ]
  };
  gameState = {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: null,
    gamePhase: 'welcome',
    submissions: [],
    categories: ["Awkward Situations"],
    scenariosByCategory: minimalScenarios,
    responseCardsDeck: [...minimalDeck], // Use a copy
    lastWinner: undefined,
    winningPlayerId: null,
  };
  return gameState;
}

// Original initializeInMemoryGame - commented out for now
/*
export function initializeInMemoryGame_ORIGINAL(): GameState {
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
*/

export function addPlayerToGame(name: string, avatar: string): Player | null {
  if (!gameState) {
    // If called when gameState is null, ensure it gets initialized (even with the simplified version)
    console.log("DEBUG: addPlayerToGame initializing game because gameState is null");
    initializeInMemoryGame();
  }
  // Ensure gameState is not null after initialization attempt
  if (!gameState) {
    console.error("CRITICAL: gameState is still null after initialization in addPlayerToGame");
    return null; // Or throw an error
  }

  if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    return null; 
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const hand: string[] = [];
  if (gameState.responseCardsDeck.length < CARDS_PER_HAND) {
    console.warn("Not enough cards in deck to deal a full hand for new player!");
    // For simplified version, we might not have enough cards, just deal what's available.
  }
  for (let i = 0; i < CARDS_PER_HAND && gameState.responseCardsDeck.length > 0; i++) {
    hand.push(gameState.responseCardsDeck.pop()!);
  }

  const newPlayer: Player = { id: newPlayerId, name, avatar, score: 0, isJudge: false, hand };
  gameState.players.push(newPlayer);
  if (gameState.gamePhase === 'welcome') {
    gameState.gamePhase = 'waiting_for_players';
  }
  return newPlayer;
}

export function startGame(): GameState | null {
  if (!gameState || gameState.players.length < 1) { 
    return null;
  }
  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
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
    // Fallback for simplified version if category is missing
     if (Object.keys(gameState.scenariosByCategory).length > 0) {
        const firstCategoryKey = Object.keys(gameState.scenariosByCategory)[0];
        const firstCategoryScenarios = gameState.scenariosByCategory[firstCategoryKey];
        if (firstCategoryScenarios && firstCategoryScenarios.length > 0) {
            gameState.currentScenario = firstCategoryScenarios[0];
        } else {
            console.error("Simplified scenarios are empty.");
            return null;
        }
    } else {
        console.error("No categories in simplified scenarios.");
        return null;
    }
  } else {
    const randomIndex = Math.floor(Math.random() * categoryScenarios.length);
    gameState.currentScenario = categoryScenarios[randomIndex];
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
    return null; 
  }

  const winningPlayer = gameState.players.find(p => p.id === winningSubmission.playerId);
  if (!winningPlayer) {
    return null; 
  }

  winningPlayer.score += 1;
  gameState.lastWinner = { player: { ...winningPlayer }, cardText: winningSubmission.cardText }; 
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
    return initializeInMemoryGame(); // Use the (potentially simplified) initializer
  }

  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    for (let i = 0; i < cardsNeeded && gameState!.responseCardsDeck.length > 0; i++) {
      player.hand.push(gameState!.responseCardsDeck.pop()!);
    }
     // For simplified version, we might run out of cards for replenishment easily.
     if (gameState!.responseCardsDeck.length < CARDS_PER_HAND * gameState!.players.length) {
       // Replenish with minimal deck if critically low in simplified mode
       console.warn("Replenishing simplified deck for next round");
       gameState!.responseCardsDeck.push(...["Card A", "Card B", "Card C", "Card D", "Card E", "Card F", "Card G", "Card H", "Card I", "Card J"]);
    }
  });

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

export function updateGame(updatedState: GameState): void {
  gameState = updatedState;
}
