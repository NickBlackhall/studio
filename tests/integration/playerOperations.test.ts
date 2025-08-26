import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  TEST_PREFIX
} from '../helpers/testDatabase';

describe('Integration - Player Operations', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  test('creates player in database', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, {
      name: `${TEST_PREFIX}TestPlayer`,
      avatar: '🎭',
      score: 0
    });

    expect(player.id).toBeDefined();
    expect(player.game_id).toBe(game.id);
    expect(player.name).toBe(`${TEST_PREFIX}TestPlayer`);
    expect(player.avatar).toBe('🎭');
    expect(player.score).toBe(0);
    expect(player.is_judge).toBe(false);
    expect(player.is_ready).toBe(false);
  });

  test('toggles player ready status', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, { is_ready: false });

    // Toggle to ready
    const { error: updateError } = await testSupabase
      .from('players')
      .update({ is_ready: true })
      .eq('id', player.id);

    expect(updateError).toBeNull();

    // Verify update
    const { data: updatedPlayer } = await testSupabase
      .from('players')
      .select('is_ready')
      .eq('id', player.id)
      .single();

    expect(updatedPlayer.is_ready).toBe(true);
  });

  test('updates player score', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, { score: 0 });

    // Increment score
    const { error } = await testSupabase
      .from('players')
      .update({ score: player.score + 1 })
      .eq('id', player.id);

    expect(error).toBeNull();

    // Verify score update
    const { data: updatedPlayer } = await testSupabase
      .from('players')
      .select('score')
      .eq('id', player.id)
      .single();

    expect(updatedPlayer.score).toBe(1);
  });

  test('assigns judge role', async () => {
    const game = await createTestGame();
    const player1 = await createTestPlayer(game.id, { is_judge: false });
    const player2 = await createTestPlayer(game.id, { is_judge: false });

    // Make player1 the judge
    const { error } = await testSupabase
      .from('players')
      .update({ is_judge: true })
      .eq('id', player1.id);

    expect(error).toBeNull();

    // Verify judge assignment
    const { data: players } = await testSupabase
      .from('players')
      .select('id, is_judge')
      .eq('game_id', game.id);

    const judge = players.find(p => p.is_judge);
    const nonJudges = players.filter(p => !p.is_judge);

    expect(judge.id).toBe(player1.id);
    expect(nonJudges).toHaveLength(1);
    expect(nonJudges[0].id).toBe(player2.id);
  });

  test('updates player avatar', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, { avatar: '🧪' });

    // Update avatar
    const { error } = await testSupabase
      .from('players')
      .update({ avatar: '🎮' })
      .eq('id', player.id);

    expect(error).toBeNull();

    // Verify avatar update
    const { data: updatedPlayer } = await testSupabase
      .from('players')
      .select('avatar')
      .eq('id', player.id)
      .single();

    expect(updatedPlayer.avatar).toBe('🎮');
  });

  test('retrieves players by game', async () => {
    const game1 = await createTestGame();
    const game2 = await createTestGame();

    // Create players in different games
    await createTestPlayer(game1.id, { name: `${TEST_PREFIX}Game1Player1` });
    await createTestPlayer(game1.id, { name: `${TEST_PREFIX}Game1Player2` });
    await createTestPlayer(game2.id, { name: `${TEST_PREFIX}Game2Player1` });

    // Get players for game1
    const { data: game1Players, error } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game1.id);

    expect(error).toBeNull();
    expect(game1Players).toHaveLength(2);
    expect(game1Players.every(p => p.game_id === game1.id)).toBe(true);
  });

  test('validates player constraints', async () => {
    const game = await createTestGame();

    // Try to create player with invalid data
    const { error } = await testSupabase
      .from('players')
      .insert({
        id: `${TEST_PREFIX}invalid`,
        game_id: 'nonexistent-game-id', // Invalid game ID
        name: `${TEST_PREFIX}TestPlayer`,
        avatar: '🎭',
        score: 0
      });

    expect(error).toBeDefined();
    expect(error.message).toContain('uuid');
  });

  test('deletes player from game', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id);

    // Verify player exists
    const { data: playersBefore } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersBefore).toHaveLength(1);

    // Delete player
    const { error } = await testSupabase
      .from('players')
      .delete()
      .eq('id', player.id);

    expect(error).toBeNull();

    // Verify player deleted
    const { data: playersAfter } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersAfter).toHaveLength(0);
  });

  test('updates ready player order in game', async () => {
    const game = await createTestGame();
    const player1 = await createTestPlayer(game.id, { is_ready: true });
    const player2 = await createTestPlayer(game.id, { is_ready: true });
    const player3 = await createTestPlayer(game.id, { is_ready: false });

    // Update ready player order
    const readyOrder = [player1.id, player2.id]; // Only ready players
    const { error } = await testSupabase
      .from('games')
      .update({ ready_player_order: readyOrder })
      .eq('id', game.id);

    expect(error).toBeNull();

    // Verify ready order update
    const { data: updatedGame } = await testSupabase
      .from('games')
      .select('ready_player_order')
      .eq('id', game.id)
      .single();

    expect(updatedGame.ready_player_order).toEqual([player1.id, player2.id]);
    expect(updatedGame.ready_player_order).not.toContain(player3.id);
  });

  test('handles concurrent player updates', async () => {
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, { score: 0 });

    // Simulate concurrent score updates
    const update1 = testSupabase
      .from('players')
      .update({ score: 1 })
      .eq('id', player.id);

    const update2 = testSupabase
      .from('players')
      .update({ score: 2 })
      .eq('id', player.id);

    // Both should succeed (last write wins)
    const [result1, result2] = await Promise.all([update1, update2]);
    
    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();

    // Verify final state
    const { data: finalPlayer } = await testSupabase
      .from('players')
      .select('score')
      .eq('id', player.id)
      .single();

    // Score should be either 1 or 2 (depending on timing)
    expect([1, 2]).toContain(finalPlayer.score);
  });

  test('removePlayerFromGame removes player and updates game state', async () => {
    // Import the function we're testing
    const { removePlayerFromGame } = await import('../../src/app/game/actions');
    
    const game = await createTestGame();
    const player1 = await createTestPlayer(game.id, { 
      name: `${TEST_PREFIX}Player1`, 
      is_ready: true 
    });
    const player2 = await createTestPlayer(game.id, { 
      name: `${TEST_PREFIX}Player2`, 
      is_ready: true 
    });

    // Set up ready player order and make player1 the judge
    await testSupabase
      .from('games')
      .update({
        ready_player_order: [player1.id, player2.id],
        current_judge_id: player1.id,
        game_phase: 'category_selection'
      })
      .eq('id', game.id);

    // Verify initial state
    const { data: playersBefore } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersBefore).toHaveLength(2);

    // Remove player1 (the judge)
    const result = await removePlayerFromGame(game.id, player1.id, 'voluntary');

    // Verify player was removed
    const { data: playersAfter } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersAfter).toHaveLength(1);
    expect(playersAfter?.[0]?.id).toBe(player2.id);

    // Verify game state was updated
    const { data: gameAfter } = await testSupabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();
    
    // Judge should be reassigned to player2
    expect(gameAfter?.current_judge_id).toBe(player2.id);
    
    // Ready order should be updated
    expect(gameAfter?.ready_player_order).toEqual([player2.id]);
    
    // Should reset to lobby since only 1 player remains (< MIN_PLAYERS_TO_START)
    expect(gameAfter?.game_phase).toBe('lobby');

    // Result should return updated game state
    expect(result).toBeTruthy();
    expect(result?.players).toHaveLength(1);
    expect(result?.players[0]?.id).toBe(player2.id);
  });

  test('removePlayerFromGame handles last player removal', async () => {
    const { removePlayerFromGame } = await import('../../src/app/game/actions');
    
    const game = await createTestGame();
    const player = await createTestPlayer(game.id, { name: `${TEST_PREFIX}OnlyPlayer` });

    // Remove the only player
    const result = await removePlayerFromGame(game.id, player.id, 'voluntary');

    // Should return null when no players remain
    expect(result).toBeNull();

    // Verify player was removed
    const { data: playersAfter } = await testSupabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);
    expect(playersAfter).toHaveLength(0);
  });
});