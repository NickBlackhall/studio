import { test as base, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

// Test environment configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log(`🔧 Test Base: Using Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);

export interface TestContext {
  supabase: ReturnType<typeof createClient<Database>>;
  gameCode: string;
  playerName: string;
  cleanupGameCode?: string;
}

export interface MultiPlayerContext extends TestContext {
  pages: Page[];
  playerNames: string[];
  contexts: TestContext[];
}

export const test = base.extend<TestContext>({
  supabase: async ({}, use) => {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await use(supabase);
  },

  gameCode: async ({}, use) => {
    // Generate unique game code for this test
    const code = `TEST${Date.now()}`;
    await use(code);
  },

  playerName: async ({}, use) => {
    // Generate unique player name for this test
    const name = `Player${Date.now()}`;
    await use(name);
  },

  cleanupGameCode: async ({ supabase }, use) => {
    let gameCodeToCleanup: string | undefined;
    
    await use(gameCodeToCleanup);
    
    // Cleanup after test
    if (gameCodeToCleanup) {
      try {
        await supabase.from('games').delete().eq('code', gameCodeToCleanup);
        console.log(`Cleaned up game: ${gameCodeToCleanup}`);
      } catch (error) {
        console.warn(`Failed to cleanup game ${gameCodeToCleanup}:`, error);
      }
    }
  },
});

export { expect };