
"use server";

import { revalidatePath } from 'next/cache';
import { 
  getInMemoryGame, 
  initializeInMemoryGame,
  addPlayerToGame,
  startGame as startGameLogic,
  selectCategoryAndDrawScenario as selectCategoryLogic,
  submitPlayerResponse as submitResponseLogic,
  selectWinningSubmission as selectWinnerLogic,
  advanceToNextRound as nextRoundLogic
} from '@/app/game-state';
import type { GameState, Player } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function getGame(): Promise<GameState> {
  let game = getInMemoryGame();
  if (!game) {
    // If no game, initialize it without revalidating paths (to avoid render-time revalidation)
    game = initializeInMemoryGame();
  }
  return game;
}

// This action is intended to be called by user interaction, like a button click
export async function initializeGameAndRevalidate(): Promise<GameState> {
  const game = initializeInMemoryGame();
  revalidatePath('/');
  revalidatePath('/game');
  return game;
}

export async function addPlayer(name: string, avatar: string): Promise<Player | null> {
  const player = addPlayerToGame(name, avatar);
  revalidatePath('/'); // Revalidate the welcome/setup page to show the new player
  return player;
}

export async function startGame(): Promise<GameState | null> {
  const game = startGameLogic();
  if (game) {
    revalidatePath('/game');
    // Consider redirecting to /game if not already there, or if called from welcome page
    // For now, revalidation handles UI update if on /game.
    // If called from /?step=setup, the link to /game becomes active.
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
    redirect('/');
  }
  return game;
}

export async function getCurrentPlayer(playerId: string): Promise<Player | undefined> {
  const game = getInMemoryGame();
  return game?.players.find(p => p.id === playerId);
}

export async function resetGameForTesting(): Promise<void> {
  initializeInMemoryGame(); // This resets the gameState variable
  revalidatePath('/');        // Revalidate the welcome page
  revalidatePath('/game');      // Revalidate the game page
  // redirect('/?step=setup');   // Temporarily removed for testing
}
