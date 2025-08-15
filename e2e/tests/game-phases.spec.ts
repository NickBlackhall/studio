import { multiPlayerTest, expect, createGameWithPlayers, startGame } from '../helpers/multi-player';
import { TEST_GAME_CONFIG } from '../fixtures/test-data';

multiPlayerTest.describe('Game Phases & Flow', () => {
  multiPlayerTest('should progress through complete game flow', async ({ multiPlayer }) => {
    const { pages, playerNames, gameCode } = multiPlayer;
    
    // Setup game with 3 players
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Should start in category_selection phase
    await expect(pages[0].locator('[data-testid="game-phase-category_selection"]')).toBeVisible({ timeout: 15000 });
    
    // Judge should see category selection interface
    const judgeIndex = await pages[0].locator('[data-testid="judge-indicator"]').isVisible() ? 0 : 
                      await pages[1].locator('[data-testid="judge-indicator"]').isVisible() ? 1 : 2;
    
    await expect(pages[judgeIndex].locator('[data-testid="category-selector"]')).toBeVisible();
    
    // Judge selects a category
    await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
    
    // All players should see the scenario and move to player_submission phase
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="game-phase-player_submission"]')).toBeVisible({ timeout: 10000 });
      await expect(pages[i].locator('[data-testid="current-scenario"]')).toBeVisible();
    }
    
    // Non-judge players submit cards
    for (let i = 0; i < 3; i++) {
      if (i !== judgeIndex) {
        // Player should see their hand
        await expect(pages[i].locator('[data-testid="player-hand"]')).toBeVisible();
        
        // Select first card
        await pages[i].click('[data-testid="hand-card"]:first-child');
        await pages[i].click('[data-testid="submit-card-button"]');
      }
    }
    
    // Should transition to judging phase
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 10000 });
    }
    
    // Judge should see submitted cards
    await expect(pages[judgeIndex].locator('[data-testid="submission-cards"]')).toBeVisible();
    
    // Judge selects winner
    await pages[judgeIndex].click('[data-testid="submission-card"]:first-child');
    await pages[judgeIndex].click('[data-testid="select-winner-button"]');
    
    // Should move to winner_announcement phase
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="game-phase-winner_announcement"]')).toBeVisible({ timeout: 10000 });
      await expect(pages[i].locator('[data-testid="round-winner"]')).toBeVisible();
    }
    
    // Should automatically progress to next round or game_over
    const isGameOver = await pages[0].locator('[data-testid="game-phase-game_over"]').isVisible({ timeout: 15000 });
    const isNextRound = await pages[0].locator('[data-testid="game-phase-category_selection"]').isVisible({ timeout: 15000 });
    
    expect(isGameOver || isNextRound).toBeTruthy();
  });

  multiPlayerTest('should handle judge rotation correctly', async ({ multiPlayer }) => {
    const { pages, playerNames } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Identify initial judge
    let currentJudgeIndex = -1;
    for (let i = 0; i < 3; i++) {
      const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
      if (isJudge) {
        currentJudgeIndex = i;
        break;
      }
    }
    
    expect(currentJudgeIndex).toBeGreaterThanOrEqual(0);
    const initialJudgeName = playerNames[currentJudgeIndex];
    
    // Complete one round
    await pages[currentJudgeIndex].click('[data-testid="category-option"]:first-child');
    
    // Wait for player submission phase
    await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible();
    
    // Players submit cards (non-judges only)
    for (let i = 0; i < 3; i++) {
      if (i !== currentJudgeIndex) {
        await pages[i].click('[data-testid="hand-card"]:first-child');
        await pages[i].click('[data-testid="submit-card-button"]');
      }
    }
    
    // Judge selects winner
    await expect(pages[currentJudgeIndex].locator('[data-testid="submission-cards"]')).toBeVisible();
    await pages[currentJudgeIndex].click('[data-testid="submission-card"]:first-child');
    await pages[currentJudgeIndex].click('[data-testid="select-winner-button"]');
    
    // Wait for next round or game end
    const gameOver = await pages[0].locator('[data-testid="game-phase-game_over"]').isVisible({ timeout: 15000 });
    
    if (!gameOver) {
      // Should have a new judge
      let newJudgeIndex = -1;
      for (let i = 0; i < 3; i++) {
        const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
        if (isJudge) {
          newJudgeIndex = i;
          break;
        }
      }
      
      // New judge should be different from initial judge
      expect(newJudgeIndex).not.toBe(currentJudgeIndex);
    }
  });

  multiPlayerTest('should handle custom card submission and judge approval', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
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
    
    // Non-judge player creates custom card
    const playerIndex = judgeIndex === 0 ? 1 : 0;
    
    // Check if custom card option is available
    const hasCustomOption = await pages[playerIndex].locator('[data-testid="create-custom-card-button"]').isVisible();
    
    if (hasCustomOption) {
      await pages[playerIndex].click('[data-testid="create-custom-card-button"]');
      await pages[playerIndex].fill('[data-testid="custom-card-input"]', 'Custom test card text');
      await pages[playerIndex].click('[data-testid="submit-custom-card-button"]');
      
      // Should move to judge_approval_pending phase
      await expect(pages[judgeIndex].locator('[data-testid="game-phase-judge_approval_pending"]')).toBeVisible({ timeout: 10000 });
      
      // Judge should see approval interface
      await expect(pages[judgeIndex].locator('[data-testid="custom-card-approval"]')).toBeVisible();
      await expect(pages[judgeIndex].locator('[data-testid="custom-card-text"]')).toContainText('Custom test card text');
      
      // Judge approves the card
      await pages[judgeIndex].click('[data-testid="approve-custom-card-button"]');
      
      // Should return to judging phase
      await expect(pages[judgeIndex].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 10000 });
    }
  });

  multiPlayerTest('should handle simultaneous card submissions', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Find judge and players
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
    
    // All non-judge players submit simultaneously
    const submissionPromises = [];
    for (let i = 0; i < 3; i++) {
      if (i !== judgeIndex) {
        submissionPromises.push(
          pages[i].click('[data-testid="hand-card"]:first-child').then(() =>
            pages[i].click('[data-testid="submit-card-button"]')
          )
        );
      }
    }
    
    await Promise.all(submissionPromises);
    
    // Should transition to judging phase
    await expect(pages[judgeIndex].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 10000 });
    
    // Judge should see all submissions
    const submissionCount = await pages[judgeIndex].locator('[data-testid="submission-card"]').count();
    expect(submissionCount).toBe(2); // 3 players - 1 judge = 2 submissions
  });

  multiPlayerTest('should handle player disconnection during game', async ({ multiPlayer }) => {
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
    
    // Judge selects category
    await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
    await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible();
    
    // One non-judge player disconnects
    const disconnectingPlayer = judgeIndex === 0 ? 1 : 0;
    await contexts[disconnectingPlayer].close();
    
    // Remaining player submits card
    const remainingPlayer = judgeIndex === 2 ? (disconnectingPlayer === 0 ? 1 : 0) : 2;
    await pages[remainingPlayer].click('[data-testid="hand-card"]:first-child');
    await pages[remainingPlayer].click('[data-testid="submit-card-button"]');
    
    // Game should continue with remaining players
    await expect(pages[judgeIndex].locator('[data-testid="game-phase-judging"]')).toBeVisible({ timeout: 15000 });
    
    // Judge should see available submissions (only from connected players)
    await expect(pages[judgeIndex].locator('[data-testid="submission-cards"]')).toBeVisible();
  });

  multiPlayerTest('should handle game completion and scoring', async ({ multiPlayer }) => {
    const { pages, supabase, gameCode } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // Play multiple rounds to reach game end (POINTS_TO_WIN = 3)
    let roundsPlayed = 0;
    const maxRounds = 10; // Safety limit
    
    while (roundsPlayed < maxRounds) {
      // Check if game is over
      const gameOver = await pages[0].locator('[data-testid="game-phase-game_over"]').isVisible({ timeout: 5000 });
      if (gameOver) break;
      
      // Find current judge
      let judgeIndex = -1;
      for (let i = 0; i < 3; i++) {
        const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
        if (isJudge) {
          judgeIndex = i;
          break;
        }
      }
      
      if (judgeIndex === -1) break; // No judge found, might be game over
      
      // Complete round
      await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
      await expect(pages[0].locator('[data-testid="game-phase-player_submission"]')).toBeVisible();
      
      // Players submit
      for (let i = 0; i < 3; i++) {
        if (i !== judgeIndex) {
          await pages[i].click('[data-testid="hand-card"]:first-child');
          await pages[i].click('[data-testid="submit-card-button"]');
        }
      }
      
      // Judge selects winner
      await expect(pages[judgeIndex].locator('[data-testid="submission-cards"]')).toBeVisible();
      await pages[judgeIndex].click('[data-testid="submission-card"]:first-child');
      await pages[judgeIndex].click('[data-testid="select-winner-button"]');
      
      // Wait for winner announcement or game over
      await expect(pages[0].locator('[data-testid="game-phase-winner_announcement"], [data-testid="game-phase-game_over"]')).toBeVisible({ timeout: 15000 });
      
      roundsPlayed++;
    }
    
    // Should eventually reach game over
    await expect(pages[0].locator('[data-testid="game-phase-game_over"]')).toBeVisible({ timeout: 10000 });
    
    // All players should see game over screen
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="game-over-display"]')).toBeVisible();
      await expect(pages[i].locator('[data-testid="final-scores"]')).toBeVisible();
    }
  });

  multiPlayerTest('should maintain game state consistency across all players', async ({ multiPlayer }) => {
    const { pages } = multiPlayer;
    
    await createGameWithPlayers(multiPlayer, 3);
    await startGame(multiPlayer);
    
    // All players should see the same game phase
    const phase1 = await pages[0].locator('[data-testid*="game-phase-"]').getAttribute('data-testid');
    const phase2 = await pages[1].locator('[data-testid*="game-phase-"]').getAttribute('data-testid');
    const phase3 = await pages[2].locator('[data-testid*="game-phase-"]').getAttribute('data-testid');
    
    expect(phase1).toBe(phase2);
    expect(phase2).toBe(phase3);
    
    // All players should see the same current scenario (after judge selection)
    let judgeIndex = -1;
    for (let i = 0; i < 3; i++) {
      const isJudge = await pages[i].locator('[data-testid="judge-indicator"]').isVisible();
      if (isJudge) {
        judgeIndex = i;
        break;
      }
    }
    
    await pages[judgeIndex].click('[data-testid="category-option"]:first-child');
    
    // Wait for all players to see the scenario
    for (let i = 0; i < 3; i++) {
      await expect(pages[i].locator('[data-testid="current-scenario"]')).toBeVisible({ timeout: 10000 });
    }
    
    // All should see the same scenario text
    const scenarioText1 = await pages[0].locator('[data-testid="scenario-text"]').textContent();
    const scenarioText2 = await pages[1].locator('[data-testid="scenario-text"]').textContent();
    const scenarioText3 = await pages[2].locator('[data-testid="scenario-text"]').textContent();
    
    expect(scenarioText1).toBe(scenarioText2);
    expect(scenarioText2).toBe(scenarioText3);
  });
});