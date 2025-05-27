
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

// This is a server-side in-memory store. Not suitable for production.
let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  // console.log("DEBUG: getInMemoryGame called. Current gameState:", gameState ? "Exists" : "null");
  return gameState;
}

// TEMPORARILY SIMPLIFIED FOR DEBUGGING TIMEOUTS
export function initializeInMemoryGame(): GameState {
  console.log("DEBUG: Using simplified initializeInMemoryGame to reset/initialize state.");
  const minimalDeck = ["Card 1", "Card 2", "Card 3", "Card 4", "Card 5", "Card 6", "Card 7", "Card 8", "Card 9", "Card 10"];
  const minimalScenarios: Record<string, Scenario[]> = {
    "Awkward Situations": [
      { id: 'awk-1', category: "Awkward Situations", text: "Minimal scenario 1 for simplified init" }
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
  console.log("DEBUG: gameState has been re-initialized by simplified initializeInMemoryGame.");
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
    // If called when gameState is null (e.g. first action after server restart, or if getGame provided a temporary one),
    // ensure it gets initialized with our standard (simplified for now) initializer.
    console.log("DEBUG: addPlayerToGame is calling initializeInMemoryGame because gameState is null.");
    initializeInMemoryGame(); 
  }
  // Ensure gameState is not null after initialization attempt
  if (!gameState) {
    console.error("CRITICAL: gameState is still null after initialization in addPlayerToGame");
    return null; 
  }

  if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    console.warn(`Player with name ${name} already exists.`);
    return gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null; // Return existing player
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const hand: string[] = [];
  if (gameState.responseCardsDeck.length < CARDS_PER_HAND) {
    console.warn("Not enough cards in deck to deal a full hand for new player! Replenishing deck for safety.");
    // Simplified deck replenishment
     gameState.responseCardsDeck.push(...["Temp Replenish 1", "Temp Replenish 2", "Temp Replenish 3", "Temp Replenish 4", "Temp Replenish 5", "Temp Replenish 6", "Temp Replenish 7"]);
  }
  for (let i = 0; i < CARDS_PER_HAND && gameState.responseCardsDeck.length > 0; i++) {
    hand.push(gameState.responseCardsDeck.pop()!);
  }

  const newPlayer: Player = { id: newPlayerId, name, avatar, score: 0, isJudge: false, hand };
  gameState.players.push(newPlayer);
  if (gameState.gamePhase === 'welcome' || gameState.players.length === 1) { // Ensure phase changes if it was just the placeholder.
    gameState.gamePhase = 'waiting_for_players';
  }
  console.log(`DEBUG: Player ${name} added. Total players: ${gameState.players.length}. Game phase: ${gameState.gamePhase}`);
  return newPlayer;
}

export function startGame(): GameState | null {
  if (!gameState || gameState.players.length < 1) { // Allow starting with 1 player for simplified testing
    console.warn("DEBUG: startGame called with insufficient players or no gameState.");
    // If gameState is null, initialize it so the game can attempt to start
    if (!gameState) {
      console.log("DEBUG: startGame initializing game because gameState is null.");
      initializeInMemoryGame();
      if (!gameState) return null; // Still null, something is wrong
    }
     // If still not enough players after potential init, return current state
    if (gameState.players.length < 1) return gameState;
  }
  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
  gameState.players.forEach(p => p.isJudge = false);
  if (gameState.players.length > 0) { // Ensure there's at least one player to be judge
    gameState.players[0].isJudge = true;
    gameState.currentJudgeId = gameState.players[0].id;
  } else {
    gameState.currentJudgeId = null; // No judge if no players
  }
  gameState.submissions = [];
  gameState.currentScenario = null;
  console.log("DEBUG: Game started. Judge:", gameState.currentJudgeId);
  return gameState;
}

export function selectCategoryAndDrawScenario(categoryId: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'category_selection' || !gameState.currentJudgeId) {
    return null;
  }
  const categoryScenarios = gameState.scenariosByCategory[categoryId];
  if (!categoryScenarios || categoryScenarios.length === 0) {
     if (Object.keys(gameState.scenariosByCategory).length > 0) {
        const firstCategoryKey = Object.keys(gameState.scenariosByCategory)[0];
        const firstCategoryScenarios = gameState.scenariosByCategory[firstCategoryKey];
        if (firstCategoryScenarios && firstCategoryScenarios.length > 0) {
            gameState.currentScenario = firstCategoryScenarios[Math.floor(Math.random() * firstCategoryScenarios.length)]; // Pick random from available
        } else {
            console.error("Simplified scenarios are empty for the first category.");
            // Fallback to a very generic scenario if all else fails
            gameState.currentScenario = { id: 'fallback-1', category: "Fallback", text: "A fallback scenario occurred." };
        }
    } else {
        console.error("No categories in scenarios. Using fallback scenario.");
        gameState.currentScenario = { id: 'fallback-1', category: "Fallback", text: "A fallback scenario occurred because no categories were found." };
    }
  } else {
    const randomIndex = Math.floor(Math.random() * categoryScenarios.length);
    gameState.currentScenario = categoryScenarios[randomIndex];
  }
  
  gameState.gamePhase = 'player_submission';
  gameState.submissions = [];
  console.log("DEBUG: Category selected, scenario drawn:", gameState.currentScenario?.text);
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
  // Replenish card for the player
  if (gameState.responseCardsDeck.length > 0) {
    player.hand.push(gameState.responseCardsDeck.pop()!);
  } else {
    console.warn("DEBUG: Deck is empty, cannot replenish player's card after submission.");
    // Optionally replenish the main deck if it's critically empty
    if(gameState.responseCardsDeck.length === 0) {
        console.log("DEBUG: Replenishing main deck as it was empty after player submission.");
        gameState.responseCardsDeck.push(...["DeckRefresh A", "DeckRefresh B", "DeckRefresh C", "DeckRefresh D", "DeckRefresh E"]);
    }
  }


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
  console.log("DEBUG: Winner selected. Player:", winningPlayer.name, "Score:", winningPlayer.score);
  return gameState;
}

export function advanceToNextRound(): GameState | null {
  if (!gameState || (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
    return null;
  }

  if (gameState.gamePhase === 'game_over') {
    console.log("DEBUG: Game over, re-initializing for a new game.");
    return initializeInMemoryGame(); // Use the (potentially simplified) initializer
  }

  // Replenish hands for all players to CARDS_PER_HAND
  gameState.players.forEach(player => {
    const cardsNeeded = CARDS_PER_HAND - player.hand.length;
    if (cardsNeeded > 0) {
      for (let i = 0; i < cardsNeeded; i++) {
        if (gameState!.responseCardsDeck.length > 0) {
          player.hand.push(gameState!.responseCardsDeck.pop()!);
        } else {
          console.warn(`DEBUG: Deck empty while trying to replenish hand for ${player.name}. Replenishing main deck.`);
          // Simplified deck replenishment if empty during hand refill
          gameState!.responseCardsDeck.push(...["Fill A", "Fill B", "Fill C", "Fill D", "Fill E", "Fill F", "Fill G"]);
          if (gameState!.responseCardsDeck.length > 0) { // Try again after replenish
             player.hand.push(gameState!.responseCardsDeck.pop()!);
          } else {
            break; // Stop if deck is still empty after attempting replenish
          }
        }
      }
    }
  });

  const currentJudgeIndex = gameState.players.findIndex(p => p.id === gameState!.currentJudgeId);
  if (gameState.players[currentJudgeIndex]) { // Check if judge exists
    gameState.players[currentJudgeIndex].isJudge = false;
  }
  
  const nextJudgeIndex = gameState.players.length > 0 ? (currentJudgeIndex + 1) % gameState.players.length : -1;

  if (nextJudgeIndex !== -1) {
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
  console.log("DEBUG: Advanced to next round. New Judge:", gameState.currentJudgeId, "Round:", gameState.currentRound);
  return gameState;
}

// This function might not be strictly necessary if all updates happen through actions that re-assign gameState.
// However, it's kept here in case direct mutation of a retrieved gameState object happens elsewhere,
// which should ideally be avoided.
export function updateGame(updatedState: GameState): void {
  gameState = updatedState;
}
