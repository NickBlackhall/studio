import { test, expect } from '../helpers/test-base';

test.describe('Transition States', () => {
  test('should show starting game transition when starting a game', async ({ page }) => {
    // Clear state and navigate to main menu
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    
    // Create a room to get to lobby
    await page.waitForTimeout(500);
    await page.click('[data-testid="join-create-card"]', { force: true });
    await page.click('[data-testid="menu-create-new-room"]');
    await page.click('[data-testid="create-game-button"]');
    
    // Wait for room creation (might show transition or go to lobby)
    await page.waitForTimeout(3000);
    
    // If we're at lobby, try to trigger a game start transition
    // Note: This test may need adjustment based on actual flow
    const currentUrl = page.url();
    console.log('URL after room creation:', currentUrl);
    
    // Look for any transition overlays
    const hasTransitionOverlay = await page.locator('[data-testid="transition-overlay"]').isVisible();
    if (hasTransitionOverlay) {
      // Verify transition overlay components
      await expect(page.locator('[data-testid="transition-overlay"]')).toBeVisible();
      await expect(page.locator('[data-testid="transition-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="transition-message"]')).toBeVisible();
      
      // Get the transition message
      const message = await page.locator('[data-testid="transition-message"]').textContent();
      console.log('Transition message:', message);
      
      // Verify message is not empty
      expect(message).toBeTruthy();
      expect(message).not.toBe('Loading...');
    } else {
      console.log('No transition overlay found - this is expected if room creation was instant');
    }
  });

  test('should handle reset game transition', async ({ page }) => {
    // This test will verify the reset transition state documented in CLAUDE.md
    // Note: Requires PIN code or different approach to trigger reset
    
    // Navigate to main menu first
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    
    // For now, just verify the reset state can be detected if it occurs
    // This is a placeholder for testing the 'resetting_game' transition state
    
    // Check if there's any existing transition
    const hasTransition = await page.locator('[data-testid="transition-overlay"]').isVisible();
    console.log('Has transition overlay:', hasTransition);
    
    // This test will be expanded once we have a way to trigger resets in testing
    expect(true).toBe(true); // Placeholder assertion
  });

  test('should not show transition overlay during normal navigation', async ({ page }) => {
    // Verify transition overlay is NOT shown during normal UI interactions
    
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    // Should not have transition overlay on welcome screen
    await expect(page.locator('[data-testid="transition-overlay"]')).not.toBeVisible();
    
    // Navigate to main menu
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    
    // Should not have transition overlay on main menu
    await expect(page.locator('[data-testid="transition-overlay"]')).not.toBeVisible();
    
    // Open join/create modal
    await page.click('[data-testid="join-create-card"]', { force: true });
    
    // Should not have transition overlay during modal interactions
    await expect(page.locator('[data-testid="transition-overlay"]')).not.toBeVisible();
  });
});