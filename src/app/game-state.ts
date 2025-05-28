// This file previously managed in-memory game state.
// With Supabase integration, this state is now managed directly
// in the database via server actions in src/app/game/actions.ts.

// The functions below are now deprecated or will be significantly refactored
// if any utility functions are still needed that don't directly manage primary state.

// import type { GameState, Player, Scenario, Submission } from '@/lib/types';
// import { CATEGORIES, SCENARIOS_DATA, RESPONSE_CARDS_DATA, getShuffledDeck, generateScenarios } from '@/lib/data';
// import { CARDS_PER_HAND, POINTS_TO_WIN } from '@/lib/types';

// let gameState: GameState | null = null; // Deprecated

export function getInMemoryGame(): null {
  // console.log("DEBUG: getInMemoryGame called - THIS IS DEPRECATED WITH SUPABASE");
  return null;
}

export function initializeInMemoryGame() {
  // console.log("DEBUG: initializeInMemoryGame called - THIS IS DEPRECATED WITH SUPABASE");
  // This logic will now live in a server action that creates a game row in Supabase.
  return null;
}

export function addPlayerToGameLogic(name: string, avatar: string) {
  // console.log("DEBUG: addPlayerToGameLogic called - THIS IS DEPRECATED WITH SUPABASE");
  // This logic will now live in a server action that creates a player row in Supabase.
  return null;
}

export function startGameLogic() {
  // console.log("DEBUG: startGameLogic called - THIS IS DEPRECATED WITH SUPABASE");
  // This logic will now live in a server action that updates the game row in Supabase.
  return null;
}

export function selectCategoryLogic(categoryId: string) {
  // console.log("DEBUG: selectCategoryLogic called - THIS IS DEPRECATED WITH SUPABASE");
  return null;
}

export function submitResponseLogic(playerId: string, cardText: string) {
  // console.log("DEBUG: submitResponseLogic called - THIS IS DEPRECATED WITH SUPABASE");
  return null;
}

export function selectWinnerLogic(cardText: string) {
  // console.log("DEBUG: selectWinnerLogic called - THIS IS DEPRECATED WITH SUPABASE");
  return null;
}

export function nextRoundLogic() {
  // console.log("DEBUG: nextRoundLogic called - THIS IS DEPRECATED WITH SUPABASE");
  return null;
}

export function updateGame() {
  // console.warn("DEBUG: updateGame called directly. THIS IS DEPRECATED WITH SUPABASE.");
  // Direct updates to a global gameState are no longer applicable.
}
