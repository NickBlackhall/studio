import { test, expect } from '../helpers/test-base';

test.describe('Basic Game Flow', () => {
  test('should load main menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Cards Against');
  });

  test('should create a new game', async ({ page, gameCode, playerName }) => {
    await page.goto('/');
    
    // Fill in player name and game code
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    
    // Create game
    await page.click('[data-testid="create-game-button"]');
    
    // Should redirect to lobby
    await expect(page).toHaveURL(`/lobby/${gameCode}`);
    await expect(page.locator('[data-testid="lobby-interface"]')).toBeVisible();
  });

  test('should join existing game', async ({ page, browser, gameCode, playerName }) => {
    // First create a game with another browser context
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    
    await hostPage.goto('/');
    await hostPage.fill('[data-testid="player-name-input"]', 'Host_Player');
    await hostPage.fill('[data-testid="game-code-input"]', gameCode);
    await hostPage.click('[data-testid="create-game-button"]');
    await hostPage.waitForURL(`/lobby/${gameCode}`);
    
    // Now join with the main page
    await page.goto('/');
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', gameCode);
    await page.click('[data-testid="join-game-button"]');
    
    // Should join the lobby
    await expect(page).toHaveURL(`/lobby/${gameCode}`);
    await expect(page.locator('[data-testid="lobby-interface"]')).toBeVisible();
    
    // Clean up
    await hostContext.close();
  });

  test('should handle invalid game codes', async ({ page, playerName }) => {
    await page.goto('/');
    
    await page.fill('[data-testid="player-name-input"]', playerName);
    await page.fill('[data-testid="game-code-input"]', 'INVALID123');
    await page.click('[data-testid="join-game-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Game not found');
  });
});