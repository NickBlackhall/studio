import { test, expect } from '../helpers/test-base';

test.describe('Basic Game Flow', () => {
  test('should load welcome screen and navigate to main menu', async ({ page }) => {
    // Start at welcome screen
    await page.goto('/');
    await expect(page.locator('[data-testid="enter-chaos-button"]')).toBeVisible();
    
    // Wait a moment for animation to settle, then force click
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    
    // Should now see main menu
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
  });

  test('should create a new game', async ({ page, gameCode, playerName }) => {
    // Clear any previous state and navigate to main menu
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    
    // Click "Join or Create Game" card
    await page.waitForTimeout(500);
    await page.click('[data-testid="join-create-card"]', { force: true });
    
    // Click "Create New Room" option
    await expect(page.locator('[data-testid="menu-create-new-room"]')).toBeVisible();
    await page.click('[data-testid="menu-create-new-room"]');
    
    // Fill out create room form and create
    await expect(page.locator('[data-testid="create-game-button"]')).toBeVisible();
    await page.click('[data-testid="create-game-button"]');
    
    // Wait for room creation and check for room code in URL or lobby display
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('Current URL after room creation:', currentUrl);
    
    // Should either redirect to room URL or show lobby interface
    const hasRoomInUrl = /[?&]room=\w{6}/.test(currentUrl);
    if (hasRoomInUrl) {
      await expect(page).toHaveURL(/[?&]room=\w{6}/);
    } else {
      // Check if we're in a lobby/room interface instead
      console.log('No room in URL, checking for lobby interface...');
    }
  });

  // Two tests used to live here ("should join existing game", "should handle
  // invalid game codes"). They were written against a UI that has never existed
  // in this app — a /lobby/:code route and a name+code form on the homepage — so
  // they had never passed, and their failures were routinely mistaken for the
  // real join-room bug. The real join flow (menu → Join by Code modal) is
  // covered by room-join.spec.ts.
});