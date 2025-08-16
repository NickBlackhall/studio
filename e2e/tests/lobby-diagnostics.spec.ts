import { test, expect } from '../helpers/test-base';

test.describe('Lobby Behavior Diagnostics', () => {
  test('diagnose lobby creation and player joining flow', async ({ page, browser }) => {
    // Clear state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    console.log('=== STARTING LOBBY DIAGNOSTIC ===');
    
    // Navigate to main menu
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
    
    // Create room
    console.log('Creating room...');
    await page.click('[data-testid="join-create-card"]', { force: true });
    await page.click('[data-testid="menu-create-new-room"]');
    await page.click('[data-testid="create-game-button"]');
    
    // Wait and diagnose what happens after room creation
    await page.waitForTimeout(3000);
    const urlAfterCreation = page.url();
    console.log('URL after room creation:', urlAfterCreation);
    
    // Check what's actually on the page
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    // Look for lobby indicators
    const hasPlayerNameInput = await page.locator('[data-testid="player-name-input"]').isVisible();
    console.log('Shows player setup form:', hasPlayerNameInput);
    
    // If we see player setup, fill it out
    if (hasPlayerNameInput) {
      console.log('Filling out player setup...');
      await page.fill('[data-testid="player-name-input"]', 'Host Player');
      await page.click('[data-testid="join-game-button"]');
      await page.waitForTimeout(2000);
    }
    
    // Check final state
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // Look for lobby interface elements (we need to add these data-testids)
    const lobbyElements = [
      'lobby-interface', 'ready-toggle', 'start-game-button', 
      'player-list', 'lobby-message'
    ];
    
    for (const element of lobbyElements) {
      const isVisible = await page.locator(`[data-testid="${element}"]`).isVisible();
      console.log(`Has ${element}:`, isVisible);
    }
    
    // Take a screenshot for analysis
    await page.screenshot({ path: 'test-results/lobby-diagnostic.png', fullPage: true });
    
    console.log('=== LOBBY DIAGNOSTIC COMPLETE ===');
  });

  test('diagnose multi-player lobby joining behavior', async ({ page, browser }) => {
    // This test will help us see what happens when a second player joins
    console.log('=== MULTI-PLAYER LOBBY DIAGNOSTIC ===');
    
    // Create host context
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    
    // Host creates room
    await hostPage.goto('/');
    await hostPage.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await hostPage.reload();
    
    await hostPage.waitForTimeout(1000);
    await hostPage.click('[data-testid="enter-chaos-button"]', { force: true });
    await hostPage.click('[data-testid="join-create-card"]', { force: true });
    await hostPage.click('[data-testid="menu-create-new-room"]');
    await hostPage.click('[data-testid="create-game-button"]');
    
    console.log('Host created room, waiting...');
    await hostPage.waitForTimeout(3000);
    
    const hostUrl = hostPage.url();
    console.log('Host URL:', hostUrl);
    
    // Extract room code if possible
    const roomCodeMatch = hostUrl.match(/room=([A-Z0-9]{6})/);
    const roomCode = roomCodeMatch ? roomCodeMatch[1] : null;
    console.log('Extracted room code:', roomCode);
    
    if (roomCode) {
      // Second player joins
      await page.goto('/');
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.reload();
      
      await page.waitForTimeout(1000);
      await page.click('[data-testid="enter-chaos-button"]', { force: true });
      await page.click('[data-testid="join-create-card"]', { force: true });
      await page.click('[data-testid="menu-join-by-code"]');
      
      // Fill room code
      await page.fill('[data-testid="game-code-input"]', roomCode);
      await page.click('[data-testid="join-room-button"]'); // Need to add this data-testid
      
      console.log('Second player attempted to join...');
      await page.waitForTimeout(3000);
      
      const joineeUrl = page.url();
      console.log('Joinee URL:', joineeUrl);
      
      // Take screenshots of both players
      await hostPage.screenshot({ path: 'test-results/lobby-host-view.png' });
      await page.screenshot({ path: 'test-results/lobby-joinee-view.png' });
    }
    
    await hostContext.close();
    console.log('=== MULTI-PLAYER DIAGNOSTIC COMPLETE ===');
  });

  test('diagnose lobby to game transition timing', async ({ page }) => {
    console.log('=== LOBBY→GAME TRANSITION DIAGNOSTIC ===');
    
    // This test will help us understand the transition UX issues
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    
    // Create room and get to lobby
    await page.waitForTimeout(1000);
    await page.click('[data-testid="enter-chaos-button"]', { force: true });
    await page.click('[data-testid="join-create-card"]', { force: true });
    await page.click('[data-testid="menu-create-new-room"]');
    await page.click('[data-testid="create-game-button"]');
    await page.waitForTimeout(3000);
    
    // If we need to set up player, do it
    const hasPlayerSetup = await page.locator('[data-testid="player-name-input"]').isVisible();
    if (hasPlayerSetup) {
      await page.fill('[data-testid="player-name-input"]', 'Test Player');
      await page.click('[data-testid="join-game-button"]');
      await page.waitForTimeout(2000);
    }
    
    // Look for start game button (need to add data-testid)
    const hasStartButton = await page.locator('[data-testid="start-game-button"]').isVisible();
    console.log('Can start game:', hasStartButton);
    
    if (hasStartButton) {
      console.log('Starting game transition...');
      
      // Monitor for transition overlay
      const transitionVisible = await page.locator('[data-testid="transition-overlay"]').isVisible();
      console.log('Transition overlay before start:', transitionVisible);
      
      // Start the game
      await page.click('[data-testid="start-game-button"]');
      
      // Monitor what happens during transition
      let transitionCount = 0;
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const stillHasTransition = await page.locator('[data-testid="transition-overlay"]').isVisible();
        const currentUrl = page.url();
        
        console.log(`T+${(Date.now() - startTime)/1000}s: URL=${currentUrl}, Transition=${stillHasTransition}`);
        
        if (stillHasTransition) transitionCount++;
        
        // Break if we've clearly transitioned
        if (currentUrl.includes('/game')) break;
      }
      
      console.log(`Transition took ${(Date.now() - startTime)/1000}s, overlay shown ${transitionCount} times`);
    }
    
    await page.screenshot({ path: 'test-results/transition-diagnostic.png' });
    console.log('=== TRANSITION DIAGNOSTIC COMPLETE ===');
  });
});