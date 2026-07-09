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
    /** Room code of the created game. Empty until createGameWithPlayers runs —
     * the app generates codes server-side; tests cannot choose one. */
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

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Mutable so createGameWithPlayers can record the app-generated code
    const fixture: MultiPlayerFixture['multiPlayer'] = {
      pages,
      contexts,
      playerNames,
      gameCode: '',
      supabase,
      cleanup: async () => {},
    };

    try {
      // Create multiple browser contexts (simulating different users)
      for (let i = 0; i < numPlayers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();

        contexts.push(context);
        pages.push(page);
        playerNames.push(`Player${i + 1}_${Date.now()}`);
      }

      fixture.cleanup = async () => {
        // Close all contexts
        await Promise.all(contexts.map(context => context.close()));

        // Cleanup database (players first — games rows reference them)
        if (fixture.gameCode) {
          try {
            const { data: game } = await supabase
              .from('games')
              .select('id')
              .eq('room_code', fixture.gameCode)
              .single();
            if (game) {
              await supabase
                .from('games')
                .update({ created_by_player_id: null, current_judge_id: null })
                .eq('id', game.id);
              await supabase.from('player_hands').delete().eq('game_id', game.id);
              await supabase.from('responses').delete().eq('game_id', game.id);
              await supabase.from('winners').delete().eq('game_id', game.id);
              await supabase.from('players').delete().eq('game_id', game.id);
              await supabase.from('games').delete().eq('id', game.id);
            }
            console.log(`Cleaned up game: ${fixture.gameCode}`);
          } catch (error) {
            console.warn(`Failed to cleanup game ${fixture.gameCode}:`, error);
          }
        }
      };

      await use(fixture);

      await fixture.cleanup();
    } catch (error) {
      // Ensure cleanup happens even if test fails
      await Promise.all(contexts.map(context => context.close()));
      throw error;
    }
  },
});

export { expect };

/**
 * Enter name + avatar on the join screen (PWAGameLayout) and join.
 * Precondition: the page shows the name entry screen (?room=CODE with no player).
 */
async function enterNameAndJoin(page: Page, name: string): Promise<void> {
  await page.waitForSelector('[data-testid="player-name-input"]', { timeout: 15_000 });
  // Let entry animations settle so clicks land on attached handlers
  await page.waitForTimeout(1000);
  await page.fill('[data-testid="player-name-input"]', name);
  // The avatar carousel starts on a "?" placeholder that the app rejects —
  // advance once to a real avatar.
  await page.click('button[aria-label="Next avatar"]');
  // force: the join button pulses forever, so it never counts as "stable"
  await page.click('[data-testid="join-game-button"]', { force: true });
  // Joined once the lobby's ready toggle renders
  await page.waitForSelector('[data-testid="ready-toggle"]', { timeout: 20_000 });
}

/**
 * Drive the app's REAL create/join flow:
 * welcome → menu → "Join or Create Game" → "Create New Room" → create,
 * read the server-generated room code from the URL, then each additional
 * player joins via /?room=CODE and the name entry screen.
 * Returns the room code (also recorded on the fixture).
 */
export async function createGameWithPlayers(
  multiPlayer: MultiPlayerFixture['multiPlayer'],
  playerCount: number = 3
): Promise<string> {
  const { pages, playerNames } = multiPlayer;

  // First player creates the game through the menu flow
  const host = pages[0];
  await host.goto('/');
  await host.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await host.goto('/?step=menu');
  await host.waitForSelector('[data-testid="join-create-card"]', { timeout: 15_000 });
  // Menu fades in over ~700ms; clicking earlier hits a not-yet-interactive card
  await host.waitForTimeout(1000);
  await host.click('[data-testid="join-create-card"]', { force: true });
  await host.waitForSelector('[data-testid="menu-create-new-room"]', { timeout: 10_000 });
  await host.waitForTimeout(500);
  await host.click('[data-testid="menu-create-new-room"]');
  await host.waitForSelector('[data-testid="create-game-button"]', { timeout: 10_000 });
  await host.click('[data-testid="create-game-button"]');

  // The app navigates to /?room=CODE with the generated code
  await host.waitForURL(/[?&]room=[A-Z2-9]{6}/, { timeout: 20_000 });
  const roomCode = new URL(host.url()).searchParams.get('room')!;
  multiPlayer.gameCode = roomCode;

  await enterNameAndJoin(host, playerNames[0]);

  // Other players join the same room directly via URL
  for (let i = 1; i < Math.min(playerCount, pages.length); i++) {
    await pages[i].goto(`/?room=${roomCode}`);
    await enterNameAndJoin(pages[i], playerNames[i]);
  }

  return roomCode;
}

export async function startGame(
  multiPlayer: MultiPlayerFixture['multiPlayer'],
  playerCount: number = 3
): Promise<void> {
  const { pages } = multiPlayer;

  // The real lobby only shows the host's start button once EVERY player has
  // toggled ready. Tests written against the old imagined flow call
  // startGame directly after joining, so make starting self-sufficient.
  await waitForAllPlayersReady(multiPlayer, playerCount);

  // force: the start button animates continuously, so it never counts as "stable"
  await pages[0].click('[data-testid="start-game-button"]', { force: true });

  // Wait for all players to be redirected to game. The transition-driven
  // auto-navigation can lag well behind the server (dev server + 3 realtime
  // clients), so fall back to direct navigation — same as a player
  // refreshing — rather than failing the whole test on the redirect.
  await Promise.all(
    pages.map(async page => {
      try {
        await page.waitForURL(/\/game/, { timeout: 45_000 });
      } catch {
        console.warn('startGame: auto-navigation to /game did not happen; navigating directly');
        await page.goto(`/game?room=${multiPlayer.gameCode}`);
        await page.waitForURL(/\/game/, { timeout: 15_000 });
      }
    })
  );
}

/**
 * Reset the game through the real UI path: in-game menu → "Reset Game
 * (Testing)" → PIN confirmation (test PIN hardcoded in PinCodeModal).
 */
export async function resetGameViaMenu(page: Page): Promise<void> {
  // Click-and-verify: a click during GameUI mount/animation can no-op
  const resetButton = page.locator('[data-testid="reset-game-button"]');
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await resetButton.isVisible()) break;
    await page.click('[data-testid="menu-button"]', { force: true });
    try {
      await resetButton.waitFor({ state: 'visible', timeout: 3_000 });
      break;
    } catch {
      // menu didn't open; retry
    }
  }
  await resetButton.click();
  await page.waitForSelector('[data-testid="pin-input"]', { timeout: 10_000 });
  await page.fill('[data-testid="pin-input"]', '6425');
  await page.click('[data-testid="pin-submit"]');
}

export async function waitForAllPlayersReady(
  multiPlayer: MultiPlayerFixture['multiPlayer'],
  playerCount: number = 3
): Promise<void> {
  const { pages } = multiPlayer;

  // All players mark themselves as ready. Click-and-verify: a click during
  // hydration/animation can silently no-op, so confirm via aria-checked and
  // retry instead of trusting the click.
  for (let i = 0; i < Math.min(playerCount, pages.length); i++) {
    const toggle = pages[i].locator('[data-testid="ready-toggle"]');
    await toggle.waitFor({ timeout: 15_000 });
    await pages[i].waitForTimeout(500);
    let confirmed = false;
    for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
      // Toggles are NOT idempotent: a blind retry after a slow server
      // response un-readies the player. Always read state before clicking.
      if ((await toggle.getAttribute('aria-checked')) === 'true') {
        confirmed = true;
        break;
      }
      await toggle.click({ force: true });
      try {
        await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
        confirmed = true;
      } catch {
        // state re-checked at top of loop before any further click
      }
    }
    if (!confirmed) {
      throw new Error(`Player ${i + 1} ready toggle never registered after 3 attempts`);
    }
  }

  // "All ready" signal in the real app: the host's start button appears
  await pages[0].waitForSelector('[data-testid="start-game-button"]', { timeout: 15_000 });
}
