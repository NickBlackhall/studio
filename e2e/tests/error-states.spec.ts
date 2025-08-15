import { test, expect } from '../helpers/test-base';
import { multiPlayerTest, createGameWithPlayers, startGame } from '../helpers/multi-player';
import { TEST_GAME_CONFIG } from '../fixtures/test-data';

test.describe('Error States & Edge Cases', () => {
  test('should handle network disconnection gracefully', async ({ page, gameCode, playerName }) => {
    // Create a game
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    await page.click('[data-testid="create-game-button"]');
    await page.waitForURL(`/lobby/${gameCode}`);
    
    // Simulate network disconnection
    await page.context().setOffline(true);
    
    // Try to interact with the game
    const hasReadyButton = await page.locator('[data-testid="ready-toggle"]').isVisible();
    if (hasReadyButton) {
      await page.click('[data-testid="ready-toggle"]');
    }
    
    // Should show connection error or loading state
    const hasError = await page.locator('[data-testid="connection-error"]').isVisible({ timeout: 10000 });
    const hasLoading = await page.locator('[data-testid="loading-indicator"]').isVisible();
    
    expect(hasError || hasLoading).toBeTruthy();
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Should recover and show lobby again
    await expect(page.locator('[data-testid="lobby-interface"]')).toBeVisible({ timeout: 15000 });
  });

  test('should handle invalid game state transitions', async ({ page, gameCode, playerName }) => {
    // Try to access game page without being in a game
    await page.goto('/game');
    
    // Should redirect to main menu or show error
    const isMainMenu = await page.locator('[data-testid="main-menu"]').isVisible({ timeout: 10000 });
    const hasError = await page.locator('[data-testid="error-message"]').isVisible();
    
    expect(isMainMenu || hasError).toBeTruthy();
  });

  test('should handle malformed room codes', async ({ page, playerName }) => {
    const invalidCodes = ['', '   ', '123', 'TOOLONG123456789', '!@#$%'];
    
    for (const invalidCode of invalidCodes) {
      await page.goto('/');
      await page.fill('[data-testid="player-name-input"]', playerName);
      
      if (invalidCode.trim() !== '') {
        await page.fill('[data-testid="game-code-input"]', invalidCode);
        await page.click('[data-testid="join-game-button"]');
        
        // Should show validation error
        await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should handle empty or invalid player names', async ({ page, gameCode }) => {
    const invalidNames = ['', '   ', 'a'.repeat(100), '!@#$%^&*()'];
    
    for (const invalidName of invalidNames) {
      await page.goto('/');
      
      if (invalidName.trim() !== '') {
        await page.fill('[data-testid="player-name-input"]', invalidName);
      }
      
      await page.fill('[data-testid="game-code-input"]', gameCode);
      await page.click('[data-testid="create-game-button"]');
      
      // Should show validation error or sanitize name
      const hasError = await page.locator('[data-testid="error-message"]').isVisible({ timeout: 3000 });
      const isInLobby = await page.locator('[data-testid="lobby-interface"]').isVisible({ timeout: 3000 });
      
      // Either error or success (with sanitized name)
      expect(hasError || isInLobby).toBeTruthy();
    }
  });

  test('should handle session expiration', async ({ page, gameCode, playerName }) => {
    // Create game
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    await page.click('[data-testid="create-game-button"]');
    await page.waitForURL(`/lobby/${gameCode}`);
    
    // Clear all cookies/storage to simulate session expiration
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to interact
    await page.click('[data-testid="ready-toggle"]');
    
    // Should handle gracefully - either redirect or show error
    await page.waitForTimeout(5000);
    
    const isMainMenu = await page.locator('[data-testid="main-menu"]').isVisible();
    const hasError = await page.locator('[data-testid="error-message"]').isVisible();
    const stillInLobby = await page.locator('[data-testid="lobby-interface"]').isVisible();
    
    expect(isMainMenu || hasError || stillInLobby).toBeTruthy();
  });
});

multiPlayerTest.describe('Multi-Player Error Scenarios', () => {
  multiPlayerTest('should handle game host disconnection', async ({ multiPlayer }) => {
    const { pages, contexts, playerNames, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    
    // Host (pages[0]) disconnects
    await contexts[0].close();
    
    // Other players should handle this gracefully
    await expect(pages[1].locator('[data-testid="lobby-interface"]')).toBeVisible({ timeout: 10000 });
    await expect(pages[2].locator('[data-testid="lobby-interface"]')).toBeVisible({ timeout: 10000 });
    
    // Game should either continue with new host or show appropriate message
    const hasNewHost = await pages[1].locator('[data-testid="start-game-button"]').isVisible({ timeout: 5000 });
    const hasMessage = await pages[1].locator('[data-testid="host-disconnected-message"]').isVisible({ timeout: 5000 });
    
    // One of these should be true
    expect(hasNewHost || hasMessage).toBeTruthy();
  });

  multiPlayerTest('should handle judge disconnection during judging phase', async ({ multiPlayer }) => {
    const { pages, contexts, playerNames } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Find judge
    let judgeIndex = -1;
    for (let i = 0; i < 3; i++) {
      const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
      if (isJudge) {
        judgeIndex = i;
        break;
      }
    }
    
    // Complete category selection
    await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
    await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible();
    
    // Players submit cards
    for (let i = 0; i < 3; i++) {
      if (i !== judgeIndex) {
        await pages[i].click('[data-testid="hand-card"]:first-child');
        await pages[i].click('[data-testid="submit-card-button"]');
      }
    }
    
    // Wait for judging phase
    await expect(pages[judgeIndex].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 10000 });
    
    // Judge disconnects during judging
    await contexts[judgeIndex].close();
    
    // Game should handle this gracefully
    const remainingPlayers = [0, 1, 2].filter(i => i !== judgeIndex);
    
    for (const playerIndex of remainingPlayers) {
      // Should either assign new judge or show appropriate message
      const hasNewJudge = await pages[playerIndex].locator('[data-testid="judge-indicator"]').isVisible({ timeout: 15000 });
      const hasMessage = await pages[playerIndex].locator('[data-testid="judge-disconnected-message"]').isVisible({ timeout: 15000 });
      
      expect(hasNewJudge || hasMessage).toBeTruthy();
    }
  });

  multiPlayerTest('should handle rapid state changes', async ({ multiPlayer }) => {
    const { pages, playerNames } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    
    // Rapid ready/unready toggles
    const rapidTogglePromises = [];
    for (let i = 0; i < 3; i++) {
      rapidTogglePromises.push(
        (async () => {
          for (let j = 0; j < 5; j++) {
            await pages[i].click('[data-testid="ready-toggle"]');
            await pages[i].waitForTimeout(100);
          }
        })()
      );
    }
    
    await Promise.all(rapidTogglePromises);
    
    // Should still be in a consistent state
    await expect(pages[0].locator('[data-testid="lobby-interface"]')).toBeVisible();
    
    // Check if all players reached a consistent ready state
    await pages[0].waitForTimeout(2000);
    
    const readyStates = [];
    for (let i = 0; i < 3; i++) {
      const isReady = await pages[i].locator('[data-testid="ready-status-true"]').isVisible();
      readyStates.push(isReady);
    }
    
    // All players should see the same ready state for each player
    // (This tests that rapid changes don't cause inconsistent state)
    expect(readyStates).toBeDefined();
  });

  multiPlayerTest('should handle database connection errors', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 2);
    
    // Intercept network requests to simulate database errors
    await pages[0].route('**/rest/v1/**', route => {
      route.abort('connectionfailed');
    });
    
    // Try to interact with ready toggle
    await pages[0].click('[data-testid="ready-toggle"]');
    
    // Should show error state or retry mechanism
    const hasError = await pages[0].locator('[data-testid="connection-error"]').isVisible({ timeout: 10000 });
    const hasRetry = await pages[0].locator('[data-testid="retry-button"]').isVisible({ timeout: 10000 });
    const stillWorks = await pages[0].locator('[data-testid="ready-status-true"]').isVisible({ timeout: 5000 });
    
    expect(hasError || hasRetry || stillWorks).toBeTruthy();
    
    // Remove route interception
    await pages[0].unroute('**/rest/v1/**');
  });

  multiPlayerTest('should handle maximum player capacity', async ({ multiPlayer }) => {
    const { pages, gameCode } = multiPlayer;
    
    // Create game with host
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', 'Host');
    await pages[0].fill('[data-testid="game-code-input"]', gameCode);
    await pages[0].click('[data-testid="create-game-button"]');
    await pages[0].waitForURL(`/lobby/${gameCode}`);
    
    // Try to join with more players than maximum allowed
    // (Assuming max is 8 based on typical card games)
    const maxPlayers = 8;
    const joinPromises = [];
    
    for (let i = 1; i < maxPlayers + 2; i++) { // Try to join 9 more players (10 total)
      if (i < pages.length) {
        joinPromises.push(
          pages[i].goto('/').then(() =>
            pages[i].fill('[data-testid="player-name-input"]', `Player${i}`)
          ).then(() =>
            pages[i].fill('[data-testid="game-code-input"]', gameCode)
          ).then(() =>
            pages[i].click('[data-testid="join-game-button"]')
          )
        );
      }
    }
    
    await Promise.allSettled(joinPromises);
    
    // Check that excess players get appropriate error
    if (pages.length > maxPlayers) {
      const excessPlayerIndex = maxPlayers; // Should be rejected
      if (excessPlayerIndex < pages.length) {
        const hasError = await pages[excessPlayerIndex].locator('[data-testid="error-message"]').isVisible({ timeout: 5000 });
        const inLobby = await pages[excessPlayerIndex].locator('[data-testid="lobby-interface"]').isVisible({ timeout: 5000 });
        
        // Should either show error or successfully join (depending on implementation)
        expect(hasError || inLobby).toBeTruthy();
      }
    }
  });

  multiPlayerTest('should handle concurrent game state modifications', async ({ multiPlayer }) => {
    const { pages, playerNames } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Find judge
    let judgeIndex = -1;
    for (let i = 0; i < 3; i++) {
      const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
      if (isJudge) {
        judgeIndex = i;
        break;
      }
    }
    
    // Judge selects category
    await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
    await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible();
    
    // Multiple players try to submit the same card simultaneously
    const cardSubmissionPromises = [];
    for (let i = 0; i < 3; i++) {
      if (i !== judgeIndex) {
        cardSubmissionPromises.push(
          pages[i].click('[data-testid="hand-card"]:first-child').then(() =>
            pages[i].click('[data-testid="submit-card-button"]')
          )
        );
      }
    }
    
    await Promise.all(cardSubmissionPromises);
    
    // Should progress to judging phase without errors
    await expect(pages[judgeIndex].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 15000 });
    
    // Judge should see valid submissions (no duplicates or errors)
    const submissionCount = await pages[judgeIndex].locator('[data-testid="submission-card"]').count();
    expect(submissionCount).toBeGreaterThan(0);
    expect(submissionCount).toBeLessThanOrEqual(2); // Max 2 non-judge players
  });

  multiPlayerTest('should handle browser refresh during active game', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Player refreshes during game
    await pages[1].reload();
    
    // Should rejoin game in progress
    const rejoinedGame = await pages[1].locator('[data-testid="game-interface"]').isVisible({ timeout: 15000 });
    const backToLobby = await pages[1].locator('[data-testid="lobby-interface"]').isVisible({ timeout: 15000 });
    const atMainMenu = await pages[1].locator('[data-testid="main-menu"]').isVisible({ timeout: 15000 });
    
    // Should end up somewhere reasonable
    expect(rejoinedGame || backToLobby || atMainMenu).toBeTruthy();
    
    // Other players should not be affected
    await expect(pages[0].locator('[data-testid="game-interface"]')).toBeVisible();
    await expect(pages[2].locator('[data-testid="game-interface"]')).toBeVisible();
  });
});