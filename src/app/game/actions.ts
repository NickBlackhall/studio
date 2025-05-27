
"use server";

import { revalidatePath } from 'next/cache';
import { 
  getInMemoryGame, 
  initializeInMemoryGame,
  addPlayerToGame as addPlayerToGameLogic,
  startGame as startGameLogic,
  selectCategoryAndDrawScenario as selectCategoryLogic,
  submitPlayerResponse as submitResponseLogic,
  selectWinningSubmission as selectWinnerLogic,
  advanceToNextRound as nextRoundLogic
} from '@/app/game-state';
import type { GameState, Player, Scenario } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function getGame(): Promise<GameState> {
  // Always return an ultra-minimal, hardcoded game state for initial render
  // to avoid any complex logic during page load if the server is struggling.
  return {
    players: [],
    currentRound: 0,
    currentJudgeId: null,
    currentScenario: { id: 'static-s1', category: 'Static Category', text: 'Static minimal scenario' },
    gamePhase: 'welcome',
    submissions: [],
    categories: ["Static Category"],
    scenariosByCategory: { "Static Category": [{ id: 'static-s1', category: 'Static Category', text: 'Static minimal scenario' }] },
    responseCardsDeck: ["Static Card 1", "Static Card 2", "Static Card 3", "Static Card 4", "Static Card 5", "Static Card 6", "Static Card 7"],
    lastWinner: undefined,
    winningPlayerId: null,
  };
}

export async function initializeGameAndRevalidate(): Promise<GameState> {
  const game = initializeInMemoryGame(); 
  // revalidatePath('/'); // Keep revalidation out for now if server is unstable
  // revalidatePath('/game');
  return game;
}

export async function addPlayer(name: string, avatar: string): Promise<Player | null> {
  const player = addPlayerToGameLogic(name, avatar); 
  // revalidatePath('/'); 
  return player;
}

export async function startGame(): Promise<GameState | null> {
  const game = startGameLogic();
  // if (game) {
  //   revalidatePath('/game');
  // }
  return game;
}

export async function selectCategory(categoryId: string): Promise<GameState | null> {
  const game = selectCategoryLogic(categoryId);
  // if (game) {
  //   revalidatePath('/game');
  // }
  return game;
}

export async function submitResponse(playerId: string, cardText: string): Promise<GameState | null> {
  const game = submitResponseLogic(playerId, cardText);
  // if (game) {
  //   revalidatePath('/game');
  // }
  return game;
}

export async function selectWinner(cardText: string): Promise<GameState | null> {
  const game = selectWinnerLogic(cardText);
  // if (game) {
  //   revalidatePath('/game');
  // }
  return game;
}

export async function nextRound(): Promise<GameState | null> {
  const game = nextRoundLogic();
  // if (game) {
  //   revalidatePath('/game');
  // }
  // if (game?.gamePhase === 'welcome') { 
  //   redirect('/'); 
  // }
  return game;
}

export async function getCurrentPlayer(playerId: string): Promise<Player | undefined> {
  const game = getInMemoryGame(); // This will now likely be the static one or one from a reset
  return game?.players.find(p => p.id === playerId);
}

export async function resetGameForTesting(): Promise<void> {
  initializeInMemoryGame(); 
  // Temporarily commented out revalidate and redirect for debugging server errors
  // revalidatePath('/');        
  // revalidatePath('/game');      
  // redirect('/?step=setup');   
}
