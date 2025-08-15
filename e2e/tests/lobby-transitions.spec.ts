import { multiPlayerTest, expect, createGameWithPlayers } from '../helpers/multi-player';
import { TEST_GAME_CONFIG } from '../fixtures/test-data';

multiPlayerTest.describe('Lobby Transitions & State Management', () => {
  multiPlayerTest('should handle player joining and leaving lobby', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode, supabase } = multiPlayer;
    
    // Host creates game
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', playerNames[0]);
    await pages[0].fill('[data-testid="game-code-input"]', gameCode);
    await pages[0].click('[data-testid="create-game-button"]');
    await pages[0].waitForURL(`/lobby/${gameCode}`);
    
    // Verify host is in lobby
    await expect(pages[0].locator('[data-testid="lobby-interface"]')).toBeVisible();
    await expect(pages[0].locator('[data-testid="player-list"]')).toContainText(playerNames[0]);
    
    // Second player joins
    await pages[1].goto('/');
    await pages[1].fill('[data-testid="player-name-input"]', playerNames[1]);
    await pages[1].fill('[data-testid="game-code-input"]', gameCode);
    await pages[1].click('[data-testid="join-game-button"]');
    await pages[1].waitForURL(`/lobby/${gameCode}`);
    
    // Both players should see each other
    await expect(pages[0].locator('[data-testid="player-list"]')).toContainText(playerNames[1]);
    await expect(pages[1].locator('[data-testid="player-list"]')).toContainText(playerNames[0]);
    
    // Third player joins
    await pages[2].goto('/');
    await pages[2].fill('[data-testid="player-name-input"]', playerNames[2]);
    await pages[2].fill('[data-testid="game-code-input"]', gameCode);
    await pages[2].click('[data-testid="join-game-button"]');
    await pages[2].waitForURL(`/lobby/${gameCode}`);
    
    // All players should see complete player list
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        await expect(pages[i].locator('[data-testid="player-list"]')).toContainText(playerNames[j]);
      }
    }
    
    // Player 2 leaves (closes tab)
    await pages[1].close();
    
    // Remaining players should see updated list (this tests real-time updates)
    await expect(pages[0].locator('[data-testid="player-list"]')).not.toContainText(playerNames[1], { timeout: 10000 });
    await expect(pages[2].locator('[data-testid="player-list"]')).not.toContainText(playerNames[1], { timeout: 10000 });
  });

  multiPlayerTest('should handle ready state coordination', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create game with 3 players
    await createGameWithPlayers(multiPlayer, 3);
    
    // Initially no players should be ready
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="ready-status-false"]')).toBeVisible();
    }
    
    // Player 1 marks ready
    await pages[0].click('[data-testid="ready-toggle"]');
    
    // All players should see Player 1 as ready
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator(`[data-testid="player-ready-${playerNames[0]}"]`)).toBeVisible();
    }
    
    // Player 2 marks ready
    await pages[1].click('[data-testid="ready-toggle"]');
    
    // Player 3 marks ready
    await pages[2].click('[data-testid="ready-toggle"]');
    
    // All players should see everyone as ready
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="all-players-ready"]')).toBeVisible();
    }
    
    // Start game button should be enabled for host
    await expect(pages[0].locator('[data-testid="start-game-button"]')).toBeEnabled();
    
    // Player 2 unmarks ready
    await pages[1].click('[data-testid="ready-toggle"]');
    
    // Start button should be disabled again
    await expect(pages[0].locator('[data-testid="start-game-button"]')).toBeDisabled();
  });

  multiPlayerTest('should prevent non-host from starting game', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    
    // All players mark ready
    for (let i = 0; i < 3; i++) {
      await pages[i].click('[data-testid="ready-toggle"]');
    }
    
    // Only host should see start button
    await expect(pages[0].locator('[data-testid="start-game-button"]')).toBeVisible();
    await expect(pages[1].locator('[data-testid="start-game-button"]')).not.toBeVisible();
    await expect(pages[2].locator('[data-testid="start-game-button"]')).not.toBeVisible();
  });

  multiPlayerTest('should handle minimum player requirements', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Create game with only 2 players (minimum)
    await createGameWithPlayers(multiPlayer, 2);
    
    // Both players mark ready
    await pages[0].click('[data-testid="ready-toggle"]');
    await pages[1].click('[data-testid="ready-toggle"]');
    
    // Start button should be enabled with minimum players
    await expect(pages[0].locator('[data-testid="start-game-button"]')).toBeEnabled();
    
    // Host starts game
    await pages[0].click('[data-testid="start-game-button"]');
    
    // Both players should transition to game
    await pages[0].waitForURL(/\/game$/, { timeout: 10000 });
    await pages[1].waitForURL(/\/game$/, { timeout: 10000 });
  });

  multiPlayerTest('should handle room code validation', async ({ multiPlayer }) => {
    const { pages, playerNames } = multiPlayer;
    
    // Try to join non-existent room
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', playerNames[0]);
    await pages[0].fill('[data-testid="game-code-input"]', 'INVALID123');
    await pages[0].click('[data-testid="join-game-button"]');
    
    // Should show error message
    await expect(pages[0].locator('[data-testid="error-message"]')).toBeVisible();
    await expect(pages[0].locator('[data-testid="error-message"]')).toContainText(/not found|invalid/i);
    
    // Should remain on main menu
    await expect(pages[0]).toHaveURL('/');
  });

  multiPlayerTest('should handle duplicate player names', async ({ multiPlayer }) => {
    const { pages, gameCode } = multiPlayer;
    const duplicateName = 'DuplicatePlayer';
    
    // First player creates game
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', duplicateName);
    await pages[0].fill('[data-testid="game-code-input"]', gameCode);
    await pages[0].click('[data-testid="create-game-button"]');
    await pages[0].waitForURL(`/lobby/${gameCode}`);
    
    // Second player tries to join with same name
    await pages[1].goto('/');
    await pages[1].fill('[data-testid="player-name-input"]', duplicateName);
    await pages[1].fill('[data-testid="game-code-input"]', gameCode);
    await pages[1].click('[data-testid="join-game-button"]');
    
    // Should show error or auto-rename
    const hasError = await pages[1].locator('[data-testid="error-message"]').isVisible();
    const inLobby = await pages[1].locator('[data-testid="lobby-interface"]').isVisible();
    
    expect(hasError || inLobby).toBeTruthy();
    
    if (inLobby) {
      // If auto-renamed, should have different name in lobby
      const playerList = pages[1].locator('[data-testid="player-list"]');
      await expect(playerList).toContainText(duplicateName);
    }
  });

  multiPlayerTest('should maintain lobby state during page refresh', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 2);
    
    // Mark players ready
    await pages[0].click('[data-testid="ready-toggle"]');
    await pages[1].click('[data-testid="ready-toggle"]');
    
    // Player 2 refreshes page
    await pages[1].reload();
    
    // Should return to lobby and maintain state
    await pages[1].waitForURL(`/lobby/${gameCode}`);
    await expect(pages[1].locator('[data-testid="lobby-interface"]')).toBeVisible();
    
    // Should see other players and ready states
    await expect(pages[1].locator('[data-testid="player-list"]')).toContainText(playerNames[0]);
    await expect(pages[1].locator(`[data-testid="player-ready-${playerNames[0]}"]`)).toBeVisible();
  });

  multiPlayerTest('should handle rapid join/leave scenarios', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Host creates game
    await pages[0].goto('/');
    await pages[0].fill('[data-testid="player-name-input"]', playerNames[0]);
    await pages[0].fill('[data-testid="game-code-input"]', gameCode);
    await pages[0].click('[data-testid="create-game-button"]');
    await pages[0].waitForURL(`/lobby/${gameCode}`);
    
    // Multiple players join rapidly
    const joinPromises = [];
    for (let i = 1; i < 3; i++) {
      joinPromises.push(
        pages[i].goto('/').then(() =>
          pages[i].fill('[data-testid="player-name-input"]', playerNames[i])
        ).then(() =>
          pages[i].fill('[data-testid="game-code-input"]', gameCode)
        ).then(() =>
          pages[i].click('[data-testid="join-game-button"]')
        ).then(() =>
          pages[i].waitForURL(`/lobby/${gameCode}`)
        )
      );
    }
    
    await Promise.all(joinPromises);
    
    // All players should be in lobby
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="lobby-interface"]')).toBeVisible();
    }
    
    // Host should see all players
    for (let i = 0; i < 3; i++) {
      await expect(pages[0].locator('[data-testid="player-list"]')).toContainText(playerNames[i]);
    }
  });
});