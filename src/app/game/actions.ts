
"use server";

import { revalidatePath } from 'next/cache';
import { 
  getInMemoryGame, 
  initializeInMemoryGame, // Added import
  addPlayerToGame,
  startGame as startGameLogic,
  selectCategoryAndDrawScenario as selectCategoryLogic,
  submitPlayerResponse as submitResponseLogic,
  selectWinningSubmission as selectWinnerLogic,
  advanceToNextRound as nextRoundLogic
} from '@/app/game-state';
import type { GameState, Player } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function getGame(): Promise<GameState> { // Return type changed to non-nullable
  let game = getInMemoryGame();
  if (!game) {
    // Initialize the game state directly if it doesn't exist,
    // without calling revalidatePath for this initial setup.
    game = initializeInMemoryGame();
  }
  return game;
}

export async function initializeGame(): Promise<GameState> {
  // This action is for explicit re-initialization (e.g., by a user action)
  // and correctly uses revalidatePath.
  const game = initializeInMemoryGame();
  revalidatePath('/');
  revalidatePath('/game');
  return game;
}

export async function addPlayer(name: string, avatar: string): Promise<Player | null> {
  const player = addPlayerToGame(name, avatar);
  revalidatePath('/'); // Revalidate welcome page to show new player
  return player;
}

export async function startGame(): Promise<GameState | null> {
  const game = startGameLogic();
  if (game) {
    revalidatePath('/game');
    // No redirect here, page component will handle rendering based on state
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
  if (game?.gamePhase === 'welcome') { // If game reset
    redirect('/');
  }
  return game;
}

export async function getCurrentPlayer(playerId: string): Promise<Player | undefined> {
  const game = getInMemoryGame();
  return game?.players.find(p => p.id === playerId);
}
