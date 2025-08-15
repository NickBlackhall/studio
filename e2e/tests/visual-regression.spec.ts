import { test, expect } from '../helpers/test-base';
import { multiPlayerTest, createGameWithPlayers, startGame } from '../helpers/multi-player';

test.describe('Visual Regression Tests', () => {
  test('should match main menu screenshot', async ({ page, gameCode, playerName }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await expect(page.locator('h1')).toBeVisible();
    
    // Take screenshot of main menu
    await expect(page).toHaveScreenshot('main-menu.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should match lobby interface screenshot', async ({ page, gameCode, playerName }) => {
    // Create a game to get to lobby
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    await page.click('[data-testid="create-game-button"]');
    
    // Wait for lobby to load
    await page.waitForURL(`/lobby/${gameCode}`);
    await expect(page.locator('[data-testid="lobby-interface"]')).toBeVisible();
    
    // Hide dynamic elements that change between runs
    await page.addStyleTag({
      content: `
        [data-testid="room-code-display"] { visibility: hidden !important; }
        .timestamp { visibility: hidden !important; }
        .loading-spinner { display: none !important; }
      `
    });
    
    await expect(page).toHaveScreenshot('lobby-interface.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should match configuration error screen', async ({ page }) => {
    // Temporarily break configuration to test error screen
    await page.addInitScript(() => {
      // Override environment variables to trigger config error
      Object.defineProperty(process, 'env', {
        value: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: '',
        }
      });
    });
    
    await page.goto('/');
    
    // Should show configuration error
    await expect(page.locator('[data-testid="configuration-error"]')).toBeVisible({ timeout: 10000 });
    
    await expect(page).toHaveScreenshot('configuration-error.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should match loading states', async ({ page, gameCode, playerName }) => {
    // Intercept network requests to create loading state
    await page.route('**/rest/v1/**', async route => {
      // Delay response to capture loading state
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    
    // Click create game and immediately capture loading state
    const createPromise = page.click('[data-testid="create-game-button"]');
    
    // Wait for loading indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible({ timeout: 5000 });
    
    await expect(page).toHaveScreenshot('loading-state.png', {
      animations: 'disabled',
    });
    
    await createPromise;
    
    // Remove route interception
    await page.unroute('**/rest/v1/**');
  });

  test('should match error message display', async ({ page, playerName }) => {
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', 'INVALID123');
    await page.click('[data-testid="join-game-button"]');
    
    // Wait for error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    await expect(page).toHaveScreenshot('error-message.png', {
      animations: 'disabled',
    });
  });
});

multiPlayerTest.describe('Multi-Player Visual Tests', () => {
  multiPlayerTest('should match game interface screenshots across different phases', async ({ multiPlayer }) => {
    const { pages, playerNames } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Category selection phase
    await expect(pages[0].locator('[data-testid="game-phase-category_selection"]')).toBeVisible({ timeout: 15000 });
    
    // Hide dynamic elements
    await pages[0].addStyleTag({
      content: `
        .timestamp { visibility: hidden !important; }
        .loading-spinner { display: none !important; }
        .player-avatar { background-image: none !important; }
      `
    });
    
    await expect(pages[0]).toHaveScreenshot('game-category-selection.png', {
      fullPage: true,
      animations: 'disabled',
    });
    
    // Find and use judge to progress
    let judgeIndex = -1;
    for (let i = 0; i < 3; i++) {
      const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
      if (isJudge) {
        judgeIndex = i;
        break;
      }
    }
    
    if (judgeIndex >= 0) {
      // Judge selects category
      await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
      
      // Player submission phase
      await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible({ timeout: 10000 });
      
      // Take screenshot of non-judge player view
      const playerIndex = judgeIndex === 0 ? 1 : 0;
      await pages[playerIndex].addStyleTag({
        content: `
          .timestamp { visibility: hidden !important; }
          .loading-spinner { display: none !important; }
        `
      });
      
      await expect(pages[playerIndex]).toHaveScreenshot('game-player-submission.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  multiPlayerTest('should match reset notification across all players', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Initiate reset
    await pages[0].click('[data-testid="reset-game-button"]');
    
    // All players should see reset notification
    const resetMessage = 'Resetting game... You will be redirected to the main menu.';
    await expect(pages[1].locator('text=' + resetMessage)).toBeVisible({ timeout: 5000 });
    
    await expect(pages[1]).toHaveScreenshot('reset-notification.png', {
      animations: 'disabled',
    });
  });

  multiPlayerTest('should match responsive design on different viewport sizes', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },      // iPhone SE
      { width: 768, height: 1024, name: 'tablet' },     // iPad
      { width: 1920, height: 1080, name: 'desktop' },   // Full HD
    ];
    
    for (const viewport of viewports) {
      await pages[0].setViewportSize({ width: viewport.width, height: viewport.height });
      await pages[0].goto('/');
      
      // Wait for responsive layout
      await pages[0].waitForTimeout(1000);
      
      await expect(pages[0]).toHaveScreenshot(`main-menu-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  multiPlayerTest('should match dark/light theme variations', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
    await pages[0].goto('/');
    
    // Test default theme
    await expect(pages[0]).toHaveScreenshot('theme-default.png', {
      fullPage: true,
      animations: 'disabled',
    });
    
    // Test with forced dark mode (if supported)
    await pages[0].emulateMedia({ colorScheme: 'dark' });
    await pages[0].waitForTimeout(500);
    
    await expect(pages[0]).toHaveScreenshot('theme-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });
    
    // Test with forced light mode
    await pages[0].emulateMedia({ colorScheme: 'light' });
    await pages[0].waitForTimeout(500);
    
    await expect(pages[0]).toHaveScreenshot('theme-light.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  multiPlayerTest('should match component states consistently', async ({ multiPlayer }) => {
    const { pages, gameCode } = multiPlayer;
    
    // Create game to get to lobby
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', 'TestPlayer');
    await pages[0].fill('[data-testid="game-code-input"]', gameCode);
    await pages[0].click('[data-testid="create-game-button"]');
    
    await pages[0].waitForURL(`/lobby/${gameCode}`);
    
    // Test ready states
    await expect(pages[0].locator('[data-testid="ready-status-false"]')).toBeVisible();
    await expect(pages[0]).toHaveScreenshot('player-not-ready.png', {
      animations: 'disabled',
    });
    
    // Toggle ready
    await pages[0].click('[data-testid="ready-toggle"]');
    await expect(pages[0].locator('[data-testid="ready-status-true"]')).toBeVisible();
    await expect(pages[0]).toHaveScreenshot('player-ready.png', {
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Component Isolation', () => {
  test('should match individual UI components', async ({ page }) => {
    await page.goto('/');
    
    // Test individual form components
    const nameInput = page.locator('[data-testid="player-name-input"]');
    await nameInput.fill('Test Player');
    
    await expect(nameInput).toHaveScreenshot('input-filled.png');
    
    // Test buttons in different states
    const createButton = page.locator('[data-testid="create-game-button"]');
    await expect(createButton).toHaveScreenshot('button-normal.png');
    
    // Hover state
    await createButton.hover();
    await expect(createButton).toHaveScreenshot('button-hover.png');
    
    // Focus state
    await createButton.focus();
    await expect(createButton).toHaveScreenshot('button-focus.png');
  });
});