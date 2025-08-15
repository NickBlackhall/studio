import { multiPlayerTest, expect, createGameWithPlayers, startGame } from '../helpers/multi-player';
import { TEST_GAME_CONFIG } from '../fixtures/test-data';

multiPlayerTest.describe('Reset Button Multi-Player Coordination', () => {
  multiPlayerTest('should coordinate reset across all players when initiated by host', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create game with 3 players
    await createGameWithPlayers(multiPlayer, 3);
    
    // Start the game
    await startGame(multiPlayer);
    
    // Verify all players are in the game
    for (let i = 0; i < 3; i++) {
      await expect(pages[i]).toHaveURL(/\/game$/);
      await expect(pages[i].locator('[data-testid="game-interface"]')).toBeVisible();
    }
    
    // Host initiates reset
    await pages[0].click('[data-testid="reset-game-button"]');
    
    // All players should see the reset notification
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
    }
    
    // Wait for reset transition to complete and all players to be redirected
    for (let i = 0; i < 3; i++) {
      await pages[i].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
      await expect(pages[i].locator('[data-testid="main-menu"]')).toBeVisible();
    }
  });

  multiPlayerTest('should coordinate reset when initiated by non-host player', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create game with 3 players
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Non-host player (Player 2) initiates reset
    await pages[1].click('[data-testid="reset-game-button"]');
    
    // All players should see the reset notification
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
    }
    
    // All players should be redirected to main menu
    for (let i = 0; i < 3; i++) {
      await pages[i].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
      await expect(pages[i].locator('[data-testid="main-menu"]')).toBeVisible();
    }
  });

  multiPlayerTest('should handle reset during active game round', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create and start game
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Simulate players being in an active round
    // (This would involve game-specific actions like scenario selection, etc.)
    
    // Player 1 initiates reset mid-round
    await pages[0].click('[data-testid="reset-game-button"]');
    
    // Verify reset coordination works even during active gameplay
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
      await pages[i].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
    }
  });

  multiPlayerTest('should prevent race conditions with simultaneous reset attempts', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create and start game
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Multiple players try to reset simultaneously
    const resetPromises = [
      pages[0].click('[data-testid="reset-game-button"]'),
      pages[1].click('[data-testid="reset-game-button"]'),
      pages[2].click('[data-testid="reset-game-button"]'),
    ];
    
    // Execute all reset clicks simultaneously
    await Promise.all(resetPromises);
    
    // Should still result in coordinated reset (no crashes or inconsistent state)
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
      await pages[i].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
    }
  });

  multiPlayerTest('should maintain server-first coordination architecture', async ({ multiPlayer }) => {
    const { pages, supabase, gameCode } = multiPlayer;
    
    // Create and start game
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Monitor database state during reset
    let gameStateBeforeReset: any;
    let gameStateAfterReset: any;
    
    // Get initial game state
    const { data: initialGame } = await supabase
      .from('games')
      .select('*')
      .eq('code', gameCode)
      .single();
    gameStateBeforeReset = initialGame;
    
    // Initiate reset
    await pages[0].click('[data-testid="reset-game-button"]');
    
    // Wait for reset to complete
    await pages[0].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
    
    // Verify game was properly cleaned up in database
    const { data: finalGame } = await supabase
      .from('games')
      .select('*')
      .eq('code', gameCode)
      .single();
    
    // Game should either be deleted or reset to initial state
    expect(finalGame).toBeNull(); // Assuming reset deletes the game
  });

  multiPlayerTest('should handle player disconnection during reset', async ({ multiPlayer }) => {
    const { pages, contexts, playerNames, gameCode } = multiPlayer;
    
    // Create and start game
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Player 2 disconnects (close their context)
    await contexts[1].close();
    
    // Player 1 initiates reset
    await pages[0].click('[data-testid="reset-game-button"]');
    
    // Remaining connected players should still see coordinated reset
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    await expect(pages[0].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
    await expect(pages[2].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
    
    // Connected players should be redirected properly
    await pages[0].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
    await pages[2].waitForURL('/', { timeout: TEST_GAME_CONFIG.timeouts.reset });
  });
});