
"use server";

import { revalidatePath } from 'next/cache';
import { 
  getInMemoryGame, 
  initializeInMemoryGame, // Keep this import
  addPlayerToGame as addPlayerToGameLogic, // Renamed to avoid conflict if we define addPlayer here
  startGame as startGameLogic,
  selectCategoryAndDrawScenario as selectCategoryLogic,
  submitPlayerResponse as submitResponseLogic,
  selectWinningSubmission as selectWinnerLogic,
  advanceToNextRound as nextRoundLogic
} from '@/app/game-state';
import type { GameState, Player, Scenario } from '@/lib/types'; // Ensure Scenario is imported
import { redirect } from 'next/navigation';

export async function getGame(): Promise<GameState> {
  let game = getInMemoryGame();
  if (!game) {
    // Return an absolutely minimal, hardcoded GameState for initial render
    // to avoid calling initializeInMemoryGame() during page load.
    console.log("DEBUG: getGame returning ultra-minimal hardcoded game state because in-memory game was null.");
    return {
      players: [],
      currentRound: 0,
      currentJudgeId: null,
      currentScenario: null, 
      gamePhase: 'welcome',
      submissions: [],
      categories: ["Temp Category"],
      scenariosByCategory: { "Temp Category": [{ id: 'temp-s1', category: 'Temp Category', text: 'Minimal hardcoded scenario' }] },
      responseCardsDeck: ["Temp Card 1", "Temp Card 2", "Temp Card 3", "Temp Card 4", "Temp Card 5", "Temp Card 6", "Temp Card 7"], // Ensure enough for a hand
      lastWinner: undefined,
      winningPlayerId: null,
    };
  }
  return game;
}

// This action is intended to be called by user interaction, like a button click
export async function initializeGameAndRevalidate(): Promise<GameState> {
  const game = initializeInMemoryGame(); // This will use the (simplified) version from game-state.ts
  revalidatePath('/');
  revalidatePath('/game');
  return game;
}

export async function addPlayer(name: string, avatar: string): Promise<Player | null> {
  // addPlayerToGameLogic is the actual implementation from game-state.ts
  const player = addPlayerToGameLogic(name, avatar); 
  revalidatePath('/'); // Revalidate the welcome/setup page to show the new player
  return player;
}

export async function startGame(): Promise<GameState | null> {
  const game = startGameLogic();
  if (game) {
    revalidatePath('/game');
  }
  return game;
}

export async function selectCategory(categoryId: string): Promise<GameState | null> {
  const game = selectCategoryLogic(categoryId);
  if (game) {
    revalidatePath('/game');
  }
  return game;
}

export async function submitResponse(playerId: string, cardText: string): Promise<GameState | null> {
  const game = submitResponseLogic(playerId, cardText);
  if (game) {
    revalidatePath('/game');
  }
  return game;
}

export async function selectWinner(cardText: string): Promise<GameState | null> {
  const game = selectWinnerLogic(cardText);
  if (game) {
    revalidatePath('/game');
  }
  return game;
}

export async function nextRound(): Promise<GameState | null> {
  const game = nextRoundLogic();
  if (game) {
    revalidatePath('/game');
  }
  if (game?.gamePhase === 'welcome') { 
    // If nextRound resets to welcome (e.g. after game over), redirect to home.
    // This redirect might need to be conditional or handled carefully
    // if it's causing issues. For now, let's keep it simple.
    redirect('/'); 
  }
  return game;
}

export async function getCurrentPlayer(playerId: string): Promise<Player | undefined> {
  const game = getInMemoryGame();
  return game?.players.find(p => p.id === playerId);
}

export async function resetGameForTesting(): Promise<void> {
  console.log("DEBUG: resetGameForTesting called. Forcing re-initialization.");
  initializeInMemoryGame(); // This resets the gameState variable using the (simplified) version
  // Temporarily commented out revalidate and redirect for debugging server errors
  // revalidatePath('/');        
  // revalidatePath('/game');      
  // redirect('/?step=setup');   
}
