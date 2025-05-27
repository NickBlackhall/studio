
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
    game = initializeInMemoryGame();
  }
  return game;
}

export async function initializeGame(): Promise<GameState> {
  const game = initializeInMemoryGame();
  revalidatePath('/');
  revalidatePath('/game');
  return game;
}

export async function addPlayer(name: string, avatar: string): Promise<Player | null> {
  const player = addPlayerToGame(name, avatar);
  revalidatePath('/'); 
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
    redirect('/');
  }
  return game;
}

export async function getCurrentPlayer(playerId: string): Promise<Player | undefined> {
  const game = getInMemoryGame();
  return game?.players.find(p => p.id === playerId);
}

export async function resetGameForTesting(): Promise<GameState> {
  const game = initializeInMemoryGame(); // This resets the gameState variable
  revalidatePath('/');               // Revalidate the welcome page
  revalidatePath('/game');             // Revalidate the game page
  // No redirect needed here, just revalidate and let the current page re-render
  return game;
}
