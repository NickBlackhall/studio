import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

// Test environment configuration  
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log(`🔧 Multi-Player: Using Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);

export interface MultiPlayerFixture {
  multiPlayer: {
    pages: Page[];
    contexts: BrowserContext[];
    playerNames: string[];
    gameCode: string;
    supabase: ReturnType<typeof createClient<Database>>;
    cleanup: () => Promise<void>;
  };
}

export const multiPlayerTest = base.extend<MultiPlayerFixture>({
  multiPlayer: async ({ browser }, use) => {
    const numPlayers = 3; // Default to 3 players for testing
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const playerNames: string[] = [];
    const gameCode = `TEST${Date.now()}`;
    
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    try {
      // Create multiple browser contexts (simulating different users)
      for (let i = 0; i < numPlayers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        contexts.push(context);
        pages.push(page);
        playerNames.push(`Player${i + 1}_${Date.now()}`);
      }
      
      const cleanup = async () => {
        // Close all contexts
        await Promise.all(contexts.map(context => context.close()));
        
        // Cleanup database
        try {
          await supabase.from('games').delete().eq('code', gameCode);
          console.log(`Cleaned up game: ${gameCode}`);
        } catch (error) {
          console.warn(`Failed to cleanup game ${gameCode}:`, error);
        }
      };
      
      await use({
        pages,
        contexts,
        playerNames,
        gameCode,
        supabase,
        cleanup,
      });
      
      await cleanup();
    } catch (error) {
      // Ensure cleanup happens even if test fails
      await Promise.all(contexts.map(context => context.close()));
      throw error;
    }
  },
});

export { expect };

// Helper functions for common multi-player scenarios
export async function createGameWithPlayers(
  multiPlayer: MultiPlayerFixture['multiPlayer'],
  playerCount: number = 3
): Promise<void> {
  const { pages, playerNames, gameCode } = multiPlayer;
  
  // First player creates the game
  await pages[0].goto('/');
  await pages[0].fill('[data-testid="player-name-input"]', playerNames[0]);
  await pages[0].fill('[data-testid="game-code-input"]', gameCode);
  await pages[0].click('[data-testid="create-game-button"]');
  
  // Wait for game to be created
  await pages[0].waitForURL(`/lobby/${gameCode}`);
  
  // Other players join the game
  for (let i = 1; i < Math.min(playerCount, pages.length); i++) {
    await pages[i].goto('/');
    await pages[i].fill('[data-testid="player-name-input"]', playerNames[i]);
    await pages[i].fill('[data-testid="game-code-input"]', gameCode);
    await pages[i].click('[data-testid="join-game-button"]');
    
    // Wait for player to join
    await pages[i].waitForURL(`/lobby/${gameCode}`);
  }
}

export async function startGame(multiPlayer: MultiPlayerFixture['multiPlayer']): Promise<void> {
  const { pages } = multiPlayer;
  
  // Host starts the game
  await pages[0].click('[data-testid="start-game-button"]');
  
  // Wait for all players to be redirected to game
  await Promise.all(
    pages.map(page => page.waitForURL(/\/game$/, { timeout: 10000 }))
  );
}

export async function waitForAllPlayersReady(
  multiPlayer: MultiPlayerFixture['multiPlayer'],
  playerCount: number = 3
): Promise<void> {
  const { pages } = multiPlayer;
  
  // All players mark themselves as ready
  for (let i = 0; i < Math.min(playerCount, pages.length); i++) {
    await pages[i].click('[data-testid="ready-button"]');
  }
  
  // Wait for all players to see the ready state
  await Promise.all(
    pages.slice(0, playerCount).map(page => 
      page.waitForSelector('[data-testid="all-players-ready"]', { timeout: 5000 })
    )
  );
}