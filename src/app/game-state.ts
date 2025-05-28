
import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

// This entire in-memory gameState will be replaced by Supabase interactions.
// For now, we'll keep a simplified version for the code to compile,
// but its values won't be the source of truth once Supabase is integrated.
let gameState: GameState | null = null;

export function getInMemoryGame(): GameState | null {
  // In a Supabase world, this would fetch from the database.
  // For now, it just returns the local variable.
  return gameState;
}

// This function will be heavily modified or replaced by functions that
// interact with Supabase to initialize or fetch game state.
export function initializeInMemoryGame(): GameState {
  console.log("DEBUG: initializeInMemoryGame called - THIS WILL BE REPLACED BY SUPABASE");
  const scenarios = generateScenarios(); // This will change to fetch from Supabase
  const initialCategories = Object.keys(scenarios);
  const defaultCategory = initialCategories.length > 0 ? initialCategories[0] : "Default Category";
  const defaultScenario = scenarios[defaultCategory]?.length > 0 ? scenarios[defaultCategory][0] : { id: 'default-s1', category: defaultCategory, text: 'Default scenario text.'};

  gameState = {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: null,
    gamePhase: 'lobby', // Default to lobby phase
    submissions: [],
    categories: initialCategories, // Will be fetched
    // scenariosByCategory: scenarios, // Will be fetched
    // responseCardsDeck: getShuffledDeck(RESPONSE_CARDS_DATA), // Will be managed via Supabase
    lastWinner: undefined,
    winningPlayerId: null,
    readyPlayerOrder: [], // Initialize new property
  };
  
  // Simulating Supabase: Ensure required fields for new types are present
  if (!gameState.categories) gameState.categories = ["Temp Category"];
  // if (!gameState.scenariosByCategory) gameState.scenariosByCategory = {"Temp Category": [{id: 'temp-s1', category: 'Temp Category', text: 'Temp scenario'}]};
  // if (!gameState.responseCardsDeck) gameState.responseCardsDeck = ["Temp Card 1", "Temp Card 2", "Temp Card 3", "Temp Card 4", "Temp Card 5", "Temp Card 6", "Temp Card 7"];


  return gameState;
}

// This function will also be heavily modified to add/update players in Supabase.
export function addPlayerToGame(name: string, avatar: string): Player | null {
  console.log("DEBUG: addPlayerToGame called - THIS WILL BE REPLACED/AUGMENTED BY SUPABASE");
  if (!gameState || gameState.gamePhase === 'lobby') { // Initialize if null or in lobby
    // In a Supabase world, we'd check if a game needs to be created or fetched.
    // For now, if gameState is null, we initialize it.
    if (!gameState) initializeInMemoryGame();
  }
  if (!gameState) return null;


  if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    return gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }
  
  const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const hand: string[] = [];
  // Hand dealing will change significantly with Supabase (fetching cards)
  // For now, deal dummy cards if deck is not fully implemented.
  // const deck = gameState.responseCardsDeck || [];
  // for (let i = 0; i < CARDS_PER_HAND; i++) {
  //   if (deck.length > 0) {
  //     hand.push(deck.pop()!);
  //   } else {
  //     hand.push(`Fallback Card ${i + 1}`);
  //   }
  // }

  const newPlayer: Player = {
    id: newPlayerId,
    name,
    avatar,
    score: 0,
    isJudge: false,
    hand,
    isReady: false // Initialize new property
  };
  gameState.players.push(newPlayer);

  // Game phase remains 'lobby' until explicitly started by a judge
  // gameState.gamePhase = 'lobby';
  
  return newPlayer;
}

// This function will interact with Supabase to start the game.
export function startGame(): GameState | null {
  console.log("DEBUG: startGame called - THIS WILL BE MODIFIED FOR SUPABASE");
  if (!gameState || gameState.players.filter(p => p.isReady).length < 2) { // Need at least 2 ready players
    // In Supabase, we'd fetch the current player list and their ready statuses.
    return gameState; // Not enough ready players
  }
  
  // Assign judge based on readyPlayerOrder
  if (gameState.readyPlayerOrder.length === 0) {
      console.error("Cannot start game, no players in readyPlayerOrder");
      return gameState;
  }
  const firstJudgeId = gameState.readyPlayerOrder[0];
  const judgePlayer = gameState.players.find(p => p.id === firstJudgeId);

  if (!judgePlayer) {
      console.error("Cannot start game, designated judge not found in players list");
      return gameState;
  }

  gameState.players.forEach(p => p.isJudge = (p.id === firstJudgeId));
  gameState.currentJudgeId = firstJudgeId;
  
  gameState.gamePhase = 'category_selection';
  gameState.currentRound = 1;
  gameState.submissions = [];
  gameState.currentScenario = null;
  gameState.lastWinner = undefined;
  gameState.winningPlayerId = null;

  // Deal hands to all players (will fetch from Supabase)
  // gameState.players.forEach(player => {
  //   const cardsNeeded = CARDS_PER_HAND - player.hand.length;
  //   if (cardsNeeded > 0) {
  //     for (let i = 0; i < cardsNeeded; i++) {
  //       if (gameState!.responseCardsDeck && gameState!.responseCardsDeck.length > 0) {
  //         player.hand.push(gameState!.responseCardsDeck.pop()!);
  //       } else {
  //         player.hand.push(`Refill Card ${i + 1}`);
  //       }
  //     }
  //   }
  // });

  return gameState;
}


// All subsequent functions (selectCategoryAndDrawScenario, submitPlayerResponse, etc.)
// will also need to be adapted to fetch/update state from Supabase.
// For brevity, their internal logic isn't fully changed yet but they'd follow a similar pattern:
// 1. Fetch current game state from Supabase.
// 2. Apply logic.
// 3. Update game state in Supabase.
// 4. Return new state (or relevant part).

export function selectCategoryAndDrawScenario(categoryId: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'category_selection' || !gameState.currentJudgeId) {
    return null;
  }
  // Scenario drawing will fetch from Supabase scenarios based on categoryId
  // For now, using placeholder logic
  // const categoryScenarios = gameState.scenariosByCategory?.[categoryId];
  // if (!categoryScenarios || categoryScenarios.length === 0) {
  //    gameState.currentScenario = { id: 'fallback-error-1', category: "Error", text: "Error: No scenarios available for this category." };
  // } else {
  //   gameState.currentScenario = categoryScenarios[Math.floor(Math.random() * categoryScenarios.length)];
  // }
  gameState.currentScenario = { id: 'temp-scenario-id', category: categoryId, text: `A random scenario for ${categoryId} from Supabase will go here.`};
  
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
  
  // Card management will be via Supabase (e.g., marking a card as used, fetching a new one)
  // player.hand = player.hand.filter(card => card !== cardText);
  // if (gameState.responseCardsDeck && gameState.responseCardsDeck.length > 0) {
  //   player.hand.push(gameState.responseCardsDeck.pop()!);
  // } else {
  //   player.hand.push("Fallback Card (Deck Empty)");
  // }

  const nonJudgeReadyPlayers = gameState.players.filter(p => !p.isJudge && p.isReady);
  if (gameState.submissions.length >= nonJudgeReadyPlayers.length) {
    gameState.gamePhase = 'judging';
  }
  return gameState;
}

export function selectWinningSubmission(cardText: string): GameState | null {
  if (!gameState || gameState.gamePhase !== 'judging' || !gameState.currentJudgeId) {
    return null;
  }
  const winningSubmission = gameState.submissions.find(s => s.cardText === cardText);
  if (!winningSubmission) return null;

  const winningPlayer = gameState.players.find(p => p.id === winningSubmission.playerId);
  if (!winningPlayer) return null;

  winningPlayer.score += 1; // Score update will happen in Supabase
  gameState.lastWinner = { player: { ...winningPlayer }, cardText: winningSubmission.cardText }; 
  
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
    // This will re-initialize the game state in Supabase
    return initializeInMemoryGame(); 
  }

  // Rotate Judge based on readyPlayerOrder
  const currentJudgeIndexInReadyOrder = gameState.readyPlayerOrder.findIndex(id => id === gameState.currentJudgeId);
  const currentPlayersInReadyOrder = gameState.players.filter(p => gameState.readyPlayerOrder.includes(p.id) && p.isReady);

  if (currentPlayersInReadyOrder.length > 0) {
    const oldJudgePlayer = gameState.players.find(p => p.id === gameState.currentJudgeId);
    if (oldJudgePlayer) oldJudgePlayer.isJudge = false;
    
    const nextJudgeIndex = (currentJudgeIndexInReadyOrder + 1) % currentPlayersInReadyOrder.length;
    const newJudgeId = gameState.readyPlayerOrder.find((id, index) => {
        const player = gameState.players.find(p => p.id === id);
        return player && player.isReady && index >= nextJudgeIndex; // Find the next ready player
    }) || currentPlayersInReadyOrder[0]?.id; // Fallback to first ready player

    if (newJudgeId) {
        const newJudgePlayer = gameState.players.find(p => p.id === newJudgeId);
        if (newJudgePlayer) newJudgePlayer.isJudge = true;
        gameState.currentJudgeId = newJudgeId;
    } else {
        gameState.currentJudgeId = null; // Should not happen if ready players exist
    }
  } else {
      gameState.currentJudgeId = null; // No judge if no ready players
  }


  // Refill hands (will be from Supabase)
  // gameState.players.forEach(player => {
  //   if (!player.isJudge && player.isReady) { // Only for active, non-judge players
  //     const cardsNeeded = CARDS_PER_HAND - player.hand.length;
  //     if (cardsNeeded > 0) {
  //       for (let i = 0; i < cardsNeeded; i++) {
  //         if (gameState!.responseCardsDeck && gameState!.responseCardsDeck.length > 0) {
  //           player.hand.push(gameState!.responseCardsDeck.pop()!);
  //         } else {
  //           player.hand.push(`Refill Card ${i + 1}`);
  //         }
  //       }
  //     }
  //   }
  // });

  gameState.currentRound += 1;
  gameState.currentScenario = null;
  gameState.submissions = [];
  gameState.gamePhase = 'category_selection';
  gameState.lastWinner = undefined;
  return gameState;
}

// This function would ideally not exist or be used very carefully,
// as Supabase becomes the source of truth.
export function updateGame(updatedState: GameState): void {
  console.warn("DEBUG: updateGame called directly. This is for in-memory state and will be deprecated with Supabase.");
  gameState = updatedState;
}

    