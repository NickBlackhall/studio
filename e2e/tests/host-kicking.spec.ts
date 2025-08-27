import { multiPlayerTest, expect } from '../helpers/multi-player';
import { test } from '../helpers/test-base';

test.describe('Host Kicking System', () => {
  test.describe('Multi-Player Tests', () => {
    multiPlayerTest('host-only dev console access', async ({ multiPlayer }) => {
      const { pages, playerNames, gameCode, supabase } = multiPlayer;
      
      // Create a game with 2 players (host + one other)
      console.log(`🧪 Testing host-only dev console with game code: ${gameCode}`);
      
      // Host (pages[0]) creates and joins game
      await pages[0].goto('/?step=menu');
      await pages[0].click('[data-testid="join-create-card"]');
      await pages[0].click('[data-testid="menu-create-new-room"]');
      await pages[0].click('[data-testid="create-game-button"]');
      
      // Wait for game creation and get room code from URL or UI
      await pages[0].waitForTimeout(2000);
      
      // Second player (pages[1]) joins the game
      const roomCodeElement = await pages[0].locator('[data-testid="room-code-display"]').textContent();
      const actualRoomCode = roomCodeElement?.trim() || gameCode;
      
      await pages[1].goto('/?step=menu');
      await pages[1].click('[data-testid="join-create-card"]');
      await pages[1].click('[data-testid="menu-join-room"]');
      await pages[1].fill('[data-testid="join-room-code-input"]', actualRoomCode);
      await pages[1].fill('[data-testid="join-player-name-input"]', playerNames[1]);
      await pages[1].click('[data-testid="join-room-button"]');
      
      // Wait for both players to be in lobby
      await pages[0].waitForTimeout(1000);
      await pages[1].waitForTimeout(1000);
      
      // TEST 1: Host should be able to access dev console
      console.log('🔍 Testing host can access dev console...');
      
      // Click menu button to open game menu
      const hostMenuButton = pages[0].locator('[data-testid="menu-button"]');
      await expect(hostMenuButton).toBeVisible({ timeout: 5000 });
      await hostMenuButton.click();
      
      // Look for game menu modal
      const gameMenuModal = pages[0].locator('[data-testid="game-menu-modal"]');
      await expect(gameMenuModal).toBeVisible({ timeout: 5000 });
      
      // Look for dev console button in the menu
      const devConsoleButton = pages[0].locator('[data-testid="dev-console-button"]');
      await expect(devConsoleButton).toBeVisible({ timeout: 5000 });
      await devConsoleButton.click();
      
      // Look for dev console PIN entry
      const devConsoleIndicator = pages[0].locator(
        'text="Dev Console Access", text="Enter PIN"'
      );
      await expect(devConsoleIndicator).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Host can access dev console');
      
      // TEST 2: Non-host should NOT be able to access dev console
      console.log('🔍 Testing non-host cannot access dev console...');
      
      // Check if menu button exists for non-host (should exist)
      const nonHostMenuButton = pages[1].locator('[data-testid="menu-button"]');
      await expect(nonHostMenuButton).toBeVisible({ timeout: 5000 });
      await nonHostMenuButton.click();
      
      // Game menu should open for non-host too
      const nonHostGameMenu = pages[1].locator('[data-testid="game-menu-modal"]');
      await expect(nonHostGameMenu).toBeVisible({ timeout: 5000 });
      
      // But dev console button should NOT be visible in development mode to non-hosts
      // (In actual development, this will be visible to all, but our host logic should block it)
      const nonHostDevConsoleButton = pages[1].locator('[data-testid="dev-console-button"]');
      const devConsoleButtonVisible = await nonHostDevConsoleButton.isVisible();
      
      if (devConsoleButtonVisible) {
        // If button is visible (in dev mode), clicking it should be blocked by host logic
        await nonHostDevConsoleButton.click();
        // Dev console should not open due to host restriction
        const nonHostDevConsole = pages[1].locator('text="Dev Console Access", text="Enter PIN"');
        await expect(nonHostDevConsole).not.toBeVisible();
        console.log('✅ Non-host dev console button exists but access blocked by host logic');
      } else {
        console.log('✅ Non-host has no dev console button visible');
      }
    });

    multiPlayerTest('crown indicators and host identification', async ({ multiPlayer }) => {
      const { pages, playerNames, gameCode } = multiPlayer;
      
      console.log(`🧪 Testing crown indicators with game code: ${gameCode}`);
      
      // Create game and join players (same as above)
      await pages[0].goto('/?step=menu');
      await pages[0].click('[data-testid="join-create-card"]');
      await pages[0].click('[data-testid="menu-create-new-room"]');
      await pages[0].click('[data-testid="create-game-button"]');
      await pages[0].waitForTimeout(2000);
      
      const roomCodeElement = await pages[0].locator('[data-testid="room-code-display"]').textContent();
      const actualRoomCode = roomCodeElement?.trim() || gameCode;
      
      await pages[1].goto('/?step=menu');
      await pages[1].click('[data-testid="join-create-card"]');
      await pages[1].click('[data-testid="menu-join-room"]');
      await pages[1].fill('[data-testid="join-room-code-input"]', actualRoomCode);
      await pages[1].fill('[data-testid="join-player-name-input"]', playerNames[1]);
      await pages[1].click('[data-testid="join-room-button"]');
      
      await pages[0].waitForTimeout(1000);
      
      // Access dev console as host
      const hostGearButton = pages[0].locator('[data-testid="settings-button"], [data-testid="gear-button"], button[aria-label*="settings"]');
      await hostGearButton.click();
      
      // Enter PIN if required (using the known PIN from DevConsoleModal)
      const pinInput = pages[0].locator('input[type="password"], input[placeholder*="PIN"], input[placeholder*="pin"]');
      if (await pinInput.isVisible()) {
        await pinInput.fill('6425');
        await pages[0].click('button[type="submit"], button:has-text("Access Console")');
        await pages[0].waitForTimeout(1000);
      }
      
      // TEST: Look for crown indicator next to host name in player list
      console.log('🔍 Checking for crown indicator...');
      
      // Look for crown emoji or crown icon in the dev console player list
      const crownIndicator = pages[0].locator('text="👑", [data-testid="host-crown"], [data-testid="crown-icon"]');
      await expect(crownIndicator).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Crown indicator found for host');
    });

    multiPlayerTest('kick button functionality', async ({ multiPlayer }) => {
      const { pages, playerNames, gameCode } = multiPlayer;
      
      console.log(`🧪 Testing kick functionality with game code: ${gameCode}`);
      
      // Setup game with 2 players
      await pages[0].goto('/?step=menu');
      await pages[0].click('[data-testid="join-create-card"]');
      await pages[0].click('[data-testid="menu-create-new-room"]');
      await pages[0].click('[data-testid="create-game-button"]');
      await pages[0].waitForTimeout(2000);
      
      const roomCodeElement = await pages[0].locator('[data-testid="room-code-display"]').textContent();
      const actualRoomCode = roomCodeElement?.trim() || gameCode;
      
      await pages[1].goto('/?step=menu');
      await pages[1].click('[data-testid="join-create-card"]');
      await pages[1].click('[data-testid="menu-join-room"]');
      await pages[1].fill('[data-testid="join-room-code-input"]', actualRoomCode);
      await pages[1].fill('[data-testid="join-player-name-input"]', playerNames[1]);
      await pages[1].click('[data-testid="join-room-button"]');
      
      await pages[0].waitForTimeout(1000);
      
      // Host accesses dev console
      const hostGearButton = pages[0].locator('[data-testid="settings-button"], [data-testid="gear-button"], button[aria-label*="settings"]');
      await hostGearButton.click();
      
      const pinInput = pages[0].locator('input[type="password"], input[placeholder*="PIN"]');
      if (await pinInput.isVisible()) {
        await pinInput.fill('6425');
        await pages[0].click('button[type="submit"], button:has-text("Access Console")');
        await pages[0].waitForTimeout(1000);
      }
      
      // TEST: Find and click kick button
      console.log('🔍 Looking for kick button...');
      
      // Look for kick/remove player button in the dev console
      const kickButton = pages[0].locator(
        'button:has-text("kick"), button:has-text("remove"), button[aria-label*="kick"], button[aria-label*="remove"], [data-testid="kick-button"]'
      );
      
      await expect(kickButton).toBeVisible({ timeout: 5000 });
      
      // TEST: Click kick button
      console.log('🎯 Clicking kick button...');
      await kickButton.click();
      
      // TEST: Verify kicked player gets redirected
      console.log('🔍 Verifying kicked player redirection...');
      
      // Wait for kicked player to be redirected away from game
      await expect(pages[1]).toHaveURL(/\/$|\?step=menu/, { timeout: 10000 });
      
      console.log('✅ Kicked player successfully redirected');
      
      // TEST: Verify host remains in game
      console.log('🔍 Verifying host remains in game...');
      
      // Host should still be in the game/lobby
      const currentHostUrl = pages[0].url();
      expect(currentHostUrl).not.toMatch(/^\/$|\?step=menu$/);
      
      console.log('✅ Host remains in game after kicking player');
    });

    multiPlayerTest('toast notifications during kick', async ({ multiPlayer }) => {
      const { pages, playerNames, gameCode } = multiPlayer;
      
      console.log(`🧪 Testing toast notifications with game code: ${gameCode}`);
      
      // Setup (same pattern as above tests)
      await pages[0].goto('/?step=menu');
      await pages[0].click('[data-testid="join-create-card"]');
      await pages[0].click('[data-testid="menu-create-new-room"]');
      await pages[0].click('[data-testid="create-game-button"]');
      await pages[0].waitForTimeout(2000);
      
      const roomCodeElement = await pages[0].locator('[data-testid="room-code-display"]').textContent();
      const actualRoomCode = roomCodeElement?.trim() || gameCode;
      
      await pages[1].goto('/?step=menu');
      await pages[1].click('[data-testid="join-create-card"]');
      await pages[1].click('[data-testid="menu-join-room"]');
      await pages[1].fill('[data-testid="join-room-code-input"]', actualRoomCode);
      await pages[1].fill('[data-testid="join-player-name-input"]', playerNames[1]);
      await pages[1].click('[data-testid="join-room-button"]');
      
      await pages[0].waitForTimeout(1000);
      
      // Access dev console and kick
      const hostGearButton = pages[0].locator('[data-testid="settings-button"], [data-testid="gear-button"], button[aria-label*="settings"]');
      await hostGearButton.click();
      
      const pinInput = pages[0].locator('input[type="password"]');
      if (await pinInput.isVisible()) {
        await pinInput.fill('6425');
        await pages[0].click('button[type="submit"]');
        await pages[0].waitForTimeout(1000);
      }
      
      const kickButton = pages[0].locator('button:has-text("kick"), button:has-text("remove"), [data-testid="kick-button"]');
      
      // TEST: Check for success toast on host side
      console.log('🔍 Checking for host success toast...');
      
      await kickButton.click();
      
      // Look for success toast message
      const successToast = pages[0].locator(
        '[data-testid="toast"], .toast, [role="status"], [aria-live="polite"], text="Player Removed", text="removed from the game"'
      );
      
      await expect(successToast).toBeVisible({ timeout: 5000 });
      console.log('✅ Success toast displayed for host');
      
      // TEST: Check for notification toast on kicked player side  
      console.log('🔍 Checking for kicked player notification...');
      
      const kickedToast = pages[1].locator(
        '[data-testid="toast"], .toast, [role="status"], text="removed from the game", text="kicked", text="You\'ve been removed"'
      );
      
      await expect(kickedToast).toBeVisible({ timeout: 5000 });
      console.log('✅ Notification toast displayed for kicked player');
    });
  });

  test.describe('Edge Cases', () => {
    test('2-player kick scenario - game resets to lobby', async ({ page, supabase }) => {
      console.log('🧪 Testing 2-player kick scenario with lobby reset');
      
      // This test verifies the behavior described in the code analysis:
      // When host kicks the only other player, game should reset to lobby
      
      // Create a test game directly in database in category_selection phase
      const gameCode = `TEST${Date.now()}`;
      
      const { data: testGame } = await supabase
        .from('games')
        .insert({
          room_code: gameCode,
          room_name: 'Kick Test',
          game_phase: 'category_selection', // In-progress game
          current_round: 1,
          max_players: 8,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (!testGame) throw new Error('Failed to create test game');
      
      // Create host player
      const { data: hostPlayer } = await supabase
        .from('players') 
        .insert({
          game_id: testGame.id,
          name: 'TestHost',
          avatar: '👑',
          is_ready: true,
          score: 2
        })
        .select()
        .single();
      
      // Create player to kick
      const { data: playerToKick } = await supabase
        .from('players')
        .insert({
          game_id: testGame.id, 
          name: 'PlayerToKick',
          avatar: '😊',
          is_ready: true,
          score: 1
        })
        .select()
        .single();
      
      if (!hostPlayer || !playerToKick) throw new Error('Failed to create players');
      
      // Set host and ready order
      await supabase
        .from('games')
        .update({
          ready_player_order: [hostPlayer.id, playerToKick.id],
          created_by_player_id: hostPlayer.id,
          current_judge_id: hostPlayer.id
        })
        .eq('id', testGame.id);
      
      console.log(`✅ Created test scenario: Game ${testGame.id} in category_selection phase`);
      console.log(`👑 Host: ${hostPlayer.name} (${hostPlayer.id})`);
      console.log(`👤 Player to kick: ${playerToKick.name} (${playerToKick.id})`);
      
      // Navigate to the game as host (this might require special handling)
      // Since we created the game directly, we may need to simulate joining
      await page.goto('/');
      
      // Join as the host player
      await page.evaluate((data) => {
        // Set up local storage to simulate being the host
        localStorage.setItem('currentPlayer', JSON.stringify({
          id: data.hostId,
          name: data.hostName,
          gameId: data.gameId
        }));
      }, {
        hostId: hostPlayer.id,
        hostName: hostPlayer.name, 
        gameId: testGame.id
      });
      
      // Navigate to game page
      await page.goto('/game');
      await page.waitForTimeout(2000);
      
      // Access dev console and perform kick
      const gearButton = page.locator('[data-testid="settings-button"], button[aria-label*="settings"]');
      await gearButton.click();
      
      const pinInput = page.locator('input[type="password"]');
      if (await pinInput.isVisible()) {
        await pinInput.fill('6425');
        await page.click('button[type="submit"]');
      }
      
      await page.waitForTimeout(1000);
      
      // Find and click kick button
      const kickButton = page.locator('button:has-text("kick"), button:has-text("remove")');
      await kickButton.click();
      
      // Wait for kick to process
      await page.waitForTimeout(3000);
      
      // Verify game reset to lobby by checking database
      const { data: gameAfterKick } = await supabase
        .from('games')
        .select('game_phase, current_round, current_scenario_id, current_judge_id')
        .eq('id', testGame.id)
        .single();
      
      console.log('📊 Game state after kick:', gameAfterKick);
      
      // Assertions for lobby reset behavior
      expect(gameAfterKick?.game_phase).toBe('lobby');
      expect(gameAfterKick?.current_round).toBe(0);
      expect(gameAfterKick?.current_scenario_id).toBeNull();
      
      // Check remaining player count
      const { data: remainingPlayers } = await supabase
        .from('players')
        .select('id, name')
        .eq('game_id', testGame.id);
      
      expect(remainingPlayers).toHaveLength(1);
      expect(remainingPlayers?.[0]?.name).toBe('TestHost');
      
      console.log('✅ Game successfully reset to lobby phase');
      console.log('✅ Host remains as only player');
      console.log('✅ Round and scenario cleared');
      
      // Cleanup
      await supabase.from('games').delete().eq('id', testGame.id);
    });
  });
});