/**
 * Transition Scenario Tests
 * Tests the specific problematic transition scenarios you mentioned:
 * - Name/avatar selection → lobby
 * - Lobby → game start
 * - Player coordination issues
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  testSupabase,
  TEST_PREFIX
} from '../helpers/testDatabase';

describe('Integration - Problematic Transition Scenarios', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Name/Avatar Selection → Lobby Transition Issues', () => {
    test('player joins lobby but subscription state is stale', async () => {
      // Scenario: Player submits name/avatar, gets added to DB, but UI doesn't update
      
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Simulate: Player gets added to database (server action succeeds)
      const player = await createTestPlayer(game.id, {
        name: `${TEST_PREFIX}NewPlayer`,
        avatar: '🎮'
      });
      
      // Check database state is correct
      const { data: dbGame } = await testSupabase
        .from('games')
        .select(`
          *
        `)
        .eq('id', game.id)
        .single();
      
      const { data: dbPlayers } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);
      
      expect(dbGame.game_phase).toBe('lobby');
      expect(dbPlayers).toHaveLength(1);
      expect(dbPlayers[0].name).toBe(`${TEST_PREFIX}NewPlayer`);
      
      // But simulate: Frontend context still shows old state
      // This happens when subscription doesn't fire or is delayed
      
      // Verify: Manual refetch gets correct state
      const manualRefetch = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();
      
      expect(manualRefetch.data?.game_phase).toBe('lobby');
      
      // The issue: If SharedGameContext doesn't get subscription update,
      // player sees old state even though they're successfully in the lobby
    });

    test('multiple players joining simultaneously cause state confusion', async () => {
      // Scenario: Multiple players submit name/avatar at same time
      
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Simulate: 3 players join lobby simultaneously
      const playerPromises = [
        createTestPlayer(game.id, { name: `${TEST_PREFIX}Player1`, avatar: '🎮' }),
        createTestPlayer(game.id, { name: `${TEST_PREFIX}Player2`, avatar: '🎭' }),
        createTestPlayer(game.id, { name: `${TEST_PREFIX}Player3`, avatar: '🎪' })
      ];
      
      const players = await Promise.all(playerPromises);
      
      // All should succeed
      players.forEach(player => {
        expect(player.id).toBeDefined();
        expect(player.game_id).toBe(game.id);
      });
      
      // Check final database state
      const { data: finalPlayers } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });
      
      expect(finalPlayers).toHaveLength(3);
      
      // The issue: Subscription flooding can cause frontend to miss updates
      // or process them out of order, showing inconsistent player lists
    });

    test('localStorage player ID gets out of sync during join', async () => {
      // Scenario: Player joins, localStorage is set, but database operation partially fails
      
      const game = await createTestGame({ game_phase: 'lobby' });
      const player = await createTestPlayer(game.id);
      
      // Simulate: localStorage gets set (frontend thinks join succeeded)
      const storageKey = `thisPlayerId_game_${game.id}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, player.id);
      }
      
      // Simulate: Player gets removed from database (connection lost, server error, etc.)
      await testSupabase
        .from('players')
        .delete()
        .eq('id', player.id);
      
      // Check for the mismatch
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      const { data: playerInDb } = await testSupabase
        .from('players')
        .select('*')
        .eq('id', player.id)
        .single();
      
      expect(storedId).toBe(player.id); // Frontend thinks player exists
      expect(playerInDb).toBeNull(); // But database doesn't have player
      
      // The issue: SharedGameContext shows player as "in game" but they're not
      
      // Cleanup
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    });
  });

  describe('Lobby → Game Start Transition Issues', () => {
    test('ready state changes during game start cause coordination problems', async () => {
      // Scenario: Players are ready, game starts, but one player changes ready state during transition
      
      const game = await createTestGame({ 
        game_phase: 'lobby',
        transition_state: 'idle',
        ready_player_order: [] 
      });
      
      const player1 = await createTestPlayer(game.id, { is_ready: true });
      const player2 = await createTestPlayer(game.id, { is_ready: true });
      
      // Set initial ready player order
      await testSupabase
        .from('games')
        .update({ ready_player_order: [player1.id, player2.id] })
        .eq('id', game.id);
      
      // Simulate: Game start process begins
      await testSupabase
        .from('games')
        .update({ transition_state: 'starting_game' })
        .eq('id', game.id);
      
      // Simulate: Player 2 toggles ready state during transition (race condition)
      const concurrentOperations = [
        // Game start continues
        testSupabase
          .from('games')
          .update({ 
            game_phase: 'category_selection',
            current_judge_id: player1.id,
            transition_state: 'idle'
          })
          .eq('id', game.id),
        
        // Player changes ready state at same time
        testSupabase
          .from('players')
          .update({ is_ready: false })
          .eq('id', player2.id)
      ];
      
      await Promise.all(concurrentOperations);
      
      // Check for inconsistency
      const { data: finalGame } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();
      
      const { data: finalPlayers } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);
      
      expect(finalGame.game_phase).toBe('category_selection'); // Game started
      expect(finalGame.ready_player_order).toEqual([player1.id, player2.id]); // But ready order is stale
      
      const player2State = finalPlayers.find(p => p.id === player2.id);
      expect(player2State?.is_ready).toBe(false); // Player is no longer ready
      
      // The issue: ready_player_order contains a player who isn't actually ready
    });

    test('transition state polling misses rapid state changes', async () => {
      // Scenario: Game transitions happen faster than polling interval can catch
      
      const game = await createTestGame({ 
        game_phase: 'lobby',
        transition_state: 'idle'
      });
      
      const statesObserved: string[] = [];
      
      // Simulate SharedGameContext polling (500ms intervals)
      const pollInterval = setInterval(async () => {
        const { data } = await testSupabase
          .from('games')
          .select('transition_state, game_phase')
          .eq('id', game.id)
          .single();
        
        if (data) {
          statesObserved.push(`${data.transition_state}|${data.game_phase}`);
        }
      }, 500);
      
      // Rapid state changes (faster than polling)
      const rapidChanges = [
        { transition_state: 'starting_game', game_phase: 'lobby' },
        { transition_state: 'dealing_cards', game_phase: 'lobby' },
        { transition_state: 'ready', game_phase: 'category_selection' },
        { transition_state: 'idle', game_phase: 'category_selection' }
      ];
      
      for (const change of rapidChanges) {
        await testSupabase
          .from('games')
          .update(change)
          .eq('id', game.id);
        
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between changes
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for polling
      clearInterval(pollInterval);
      
      console.log('States observed by polling:', statesObserved);
      
      // The issue: Polling may miss intermediate transition states
      // Leading to jarring UI jumps or stuck transition screens
      expect(statesObserved.length).toBeGreaterThan(0);
      
      // Check final state is correct
      const { data: finalState } = await testSupabase
        .from('games')
        .select('transition_state, game_phase')
        .eq('id', game.id)
        .single();
      
      expect(finalState?.transition_state).toBe('idle');
      expect(finalState?.game_phase).toBe('category_selection');
    });

    test('navigation happens before transition state is cleared', async () => {
      // Scenario: Frontend navigates to game screen while server is still in transition
      
      const game = await createTestGame({ 
        game_phase: 'lobby',
        transition_state: 'starting_game' 
      });
      
      // Simulate: Frontend gets subscription update that game phase changed
      await testSupabase
        .from('games')
        .update({ game_phase: 'category_selection' })
        .eq('id', game.id);
      
      // Check intermediate state (what frontend might see)
      const { data: intermediateState } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();
      
      expect(intermediateState?.game_phase).toBe('category_selection');
      expect(intermediateState?.transition_state).toBe('starting_game'); // Still transitioning!
      
      // The issue: Frontend navigates to game page, but transition overlay still shows
      // because transition_state hasn't been cleared yet
      
      // Server completes transition
      await testSupabase
        .from('games')
        .update({ transition_state: 'idle' })
        .eq('id', game.id);
      
      const { data: finalState } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();
      
      expect(finalState?.game_phase).toBe('category_selection');
      expect(finalState?.transition_state).toBe('idle');
    });
  });

  describe('Player Coordination During Transitions', () => {
    test('players see different game states during transitions', async () => {
      // Scenario: Some players see old state, others see new state during transition
      
      const game = await createTestGame({ game_phase: 'lobby' });
      const players = await Promise.all([
        createTestPlayer(game.id, { is_ready: true }),
        createTestPlayer(game.id, { is_ready: true }),
        createTestPlayer(game.id, { is_ready: true })
      ]);
      
      // Start game transition
      await testSupabase
        .from('games')
        .update({ 
          transition_state: 'starting_game',
          ready_player_order: players.map(p => p.id)
        })
        .eq('id', game.id);
      
      // Simulate: Different players query at different times during transition
      const playerViews: any[] = [];
      
      // Player 1 checks immediately
      const view1 = await testSupabase
        .from('games')
        .select('game_phase, transition_state')
        .eq('id', game.id)
        .single();
      playerViews.push({ player: 'Player1', ...view1.data });
      
      // Game phase changes mid-transition
      await testSupabase
        .from('games')
        .update({ game_phase: 'category_selection' })
        .eq('id', game.id);
      
      // Player 2 checks after phase change but before transition clear
      const view2 = await testSupabase
        .from('games')
        .select('game_phase, transition_state')
        .eq('id', game.id)
        .single();
      playerViews.push({ player: 'Player2', ...view2.data });
      
      // Transition completes
      await testSupabase
        .from('games')
        .update({ transition_state: 'idle' })
        .eq('id', game.id);
      
      // Player 3 checks after transition complete
      const view3 = await testSupabase
        .from('games')
        .select('game_phase, transition_state')
        .eq('id', game.id)
        .single();
      playerViews.push({ player: 'Player3', ...view3.data });
      
      console.log('Player views during transition:', playerViews);
      
      // The issue: Players see inconsistent states
      expect(playerViews[0].game_phase).toBe('lobby');
      expect(playerViews[0].transition_state).toBe('starting_game');
      
      expect(playerViews[1].game_phase).toBe('category_selection');
      expect(playerViews[1].transition_state).toBe('starting_game');
      
      expect(playerViews[2].game_phase).toBe('category_selection');
      expect(playerViews[2].transition_state).toBe('idle');
      
      // This causes some players to see loading screens while others see the game
    });

    test('subscription updates arrive out of order', async () => {
      // Scenario: Database changes happen in order, but subscriptions arrive scrambled
      
      const game = await createTestGame({ game_phase: 'lobby' });
      
      const subscriptionEvents: any[] = [];
      
      // Set up subscription to capture all events
      const channel = testSupabase
        .channel(`order-test-${game.id}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'games' }, 
            (payload) => {
              subscriptionEvents.push({
                timestamp: Date.now(),
                eventType: payload.eventType,
                newData: payload.new
              });
            }
        );

      await channel.subscribe();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Make ordered database changes
      const orderedChanges = [
        { transition_state: 'starting_game' },
        { game_phase: 'category_selection' },
        { current_round: 2 },
        { transition_state: 'idle' }
      ];
      
      for (const change of orderedChanges) {
        await testSupabase
          .from('games')
          .update(change)
          .eq('id', game.id);
        
        // Small delay between changes
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      await testSupabase.removeChannel(channel);
      
      console.log(`Received ${subscriptionEvents.length} subscription events for ${orderedChanges.length} database changes`);
      
      // The issue: Even if we get all events, they might not arrive in order
      // This can cause frontend state to update incorrectly
      expect(subscriptionEvents.length).toBeGreaterThanOrEqual(orderedChanges.length);
    });
  });

  describe('Reset Transition Issues', () => {
    test('reset flag coordination between localStorage and context', async () => {
      // Scenario: Reset process involves localStorage flag + database state + navigation
      
      const game = await createTestGame({ 
        game_phase: 'category_selection',
        transition_state: 'idle' 
      });
      
      // Simulate reset process starting
      await testSupabase
        .from('games')
        .update({ 
          transition_state: 'resetting_game',
          transition_message: 'Resetting game...' 
        })
        .eq('id', game.id);
      
      // Check reset state is set
      const { data: resetState } = await testSupabase
        .from('games')
        .select('*')
        .eq('id', game.id)
        .single();
      
      expect(resetState?.transition_state).toBe('resetting_game');
      
      // Simulate: SharedGameContext detects reset and sets localStorage flag
      if (typeof window !== 'undefined') {
        localStorage.setItem('gameResetFlag', 'true');
      }
      
      // Simulate: Reset completes on server
      await testSupabase
        .from('games')
        .update({ 
          game_phase: 'lobby',
          current_round: 1,
          transition_state: 'idle',
          transition_message: null
        })
        .eq('id', game.id);
      
      // Check localStorage flag exists
      const resetFlag = typeof window !== 'undefined' ? localStorage.getItem('gameResetFlag') : null;
      expect(resetFlag).toBe('true');
      
      // The issue: Multiple systems (localStorage, database, navigation) need to coordinate
      // If any part fails, players can get stuck in inconsistent states
      
      // Cleanup
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gameResetFlag');
      }
    });
  });
});