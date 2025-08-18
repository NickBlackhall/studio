/**
 * Subscription Timing Tests
 * Tests that expose the specific timing issues causing transition problems
 */

import { 
  setupTestDatabase, 
  cleanupTestData, 
  createTestGame,
  createTestPlayer,
  TEST_PREFIX
} from '../helpers/testDatabase';
import { testSupabase } from '../helpers/testSupabase';
import { openSubscribedChannel, nextEvent } from '../helpers/realtime';

describe('Integration - Subscription Timing Issues', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Real-time Subscription Behavior', () => {
    test('subscription receives database changes immediately', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Set up subscription using proper helper
      const channel = await openSubscribedChannel(
        testSupabase, 
        `test-game-updates-${game.id}`,
        ch => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {})
      );
      
      // Make a database change AFTER subscription is confirmed
      await testSupabase
        .from('games')
        .update({ game_phase: 'category_selection' })
        .eq('id', game.id);
      
      // Wait for real-time event using helper
      const event = await nextEvent(channel);
      
      // Check if update was received
      expect(event).toBeDefined();
      expect(event.table).toBe('games');
      expect(event.new.game_phase).toBe('category_selection');
      
      // Cleanup
      await testSupabase.removeChannel(channel);
    });

    test('multiple rapid database changes cause subscription flooding', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id);
      
      const receivedUpdates: any[] = [];
      const channel = await openSubscribedChannel(
        testSupabase,
        `test-rapid-updates-${game.id}`,
        ch => ch.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          receivedUpdates.push({
            eventType: payload.eventType,
            table: payload.table,
            timestamp: Date.now()
          });
        })
      );
      
      // Rapid database changes (simulating multiple players acting)
      const changePromises = [
        testSupabase.from('players').update({ is_ready: true }).eq('id', player.id),
        testSupabase.from('games').update({ transition_state: 'starting_game' }).eq('id', game.id),
        testSupabase.from('games').update({ game_phase: 'category_selection' }).eq('id', game.id),
        testSupabase.from('games').update({ transition_state: 'idle' }).eq('id', game.id)
      ];
      
      await Promise.all(changePromises);
      
      // Wait for events to be received - proper timing with subscription helper
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for update flooding
      expect(receivedUpdates.length).toBeGreaterThan(3);
      console.log(`Received ${receivedUpdates.length} subscription updates for 4 database changes`);
      
      await testSupabase.removeChannel(channel);
    });
  });

  describe('Transition State Race Conditions', () => {
    test('transition state changes can be missed between subscription updates', async () => {
      const game = await createTestGame({ 
        game_phase: 'lobby',
        transition_state: 'idle' 
      });
      
      // Simulate the server action pattern: set transition → do work → clear transition
      const transitionStates: string[] = [];
      
      // Start monitoring transition states
      const monitorInterval = setInterval(async () => {
        const { data } = await testSupabase
          .from('games')
          .select('transition_state')
          .eq('id', game.id)
          .single();
        
        if (data) {
          transitionStates.push(data.transition_state);
        }
      }, 100); // Check every 100ms
      
      // Simulate rapid transition state changes
      await testSupabase
        .from('games')
        .update({ transition_state: 'starting_game' })
        .eq('id', game.id);
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief work
      
      await testSupabase
        .from('games')
        .update({ 
          transition_state: 'idle',
          game_phase: 'category_selection' 
        })
        .eq('id', game.id);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      clearInterval(monitorInterval);
      
      // Check if intermediate states were captured
      expect(transitionStates).toContain('starting_game');
      expect(transitionStates).toContain('idle');
      
      // The issue: if monitoring frequency is too low, intermediate states get missed
      console.log('Captured transition states:', transitionStates);
    });

    test('polling vs subscription timing for transition detection', async () => {
      const game = await createTestGame({ transition_state: 'idle' });
      
      const subscriptionUpdates: string[] = [];
      const pollingUpdates: string[] = [];
      
      // Set up subscription
      const channel = testSupabase
        .channel(`transition-timing-${game.id}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'games' }, 
            async (payload) => {
              if (payload.new && typeof payload.new === 'object' && 'transition_state' in payload.new) {
                subscriptionUpdates.push(payload.new.transition_state as string);
              }
            }
        );

      await channel.subscribe();
      
      // Set up polling
      const pollInterval = setInterval(async () => {
        const { data } = await testSupabase
          .from('games')
          .select('transition_state')
          .eq('id', game.id)
          .single();
        
        if (data) {
          pollingUpdates.push(data.transition_state);
        }
      }, 500); // Poll every 500ms (matching SharedGameContext)
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Rapid transition changes
      await testSupabase.from('games').update({ transition_state: 'dealing_cards' }).eq('id', game.id);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await testSupabase.from('games').update({ transition_state: 'ready' }).eq('id', game.id);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await testSupabase.from('games').update({ transition_state: 'idle' }).eq('id', game.id);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(pollInterval);
      await testSupabase.removeChannel(channel);
      
      console.log('Subscription captured:', subscriptionUpdates);
      console.log('Polling captured:', pollingUpdates);
      
      // Subscription should be more comprehensive than polling
      expect(subscriptionUpdates.length).toBeGreaterThanOrEqual(pollingUpdates.length);
    });
  });

  describe('Navigation Timing Race Conditions', () => {
    test('player state changes during navigation can cause desync', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      const player = await createTestPlayer(game.id, { is_ready: false });
      
      // Simulate: Player toggles ready, then immediately navigation happens
      const operations = [];
      
      // Operation 1: Toggle ready
      operations.push(
        testSupabase
          .from('players')
          .update({ is_ready: true })
          .eq('id', player.id)
      );
      
      // Operation 2: Game phase change (simulating navigation trigger)
      operations.push(
        testSupabase
          .from('games')
          .update({ game_phase: 'category_selection' })
          .eq('id', game.id)
      );
      
      // Execute simultaneously
      const results = await Promise.all(operations);
      results.forEach(result => expect(result.error).toBeNull());
      
      // Check final state consistency
      const { data: finalGame } = await testSupabase
        .from('games')
        .select(`
          *,
          players (*)
        `)
        .eq('id', game.id)
        .single();
      
      // Both changes should be reflected
      expect(finalGame.game_phase).toBe('category_selection');
      // Note: Supabase doesn't support nested selects in this test environment
      // So we query players separately
      const { data: playersData } = await testSupabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);
      
      const updatedPlayer = playersData?.find(p => p.id === player.id);
      expect(updatedPlayer?.is_ready).toBe(true);
    });

    test('localStorage and database state can become inconsistent', async () => {
      const game = await createTestGame();
      const player = await createTestPlayer(game.id);
      
      // Simulate localStorage operations that happen during navigation
      const playerIdKey = `thisPlayerId_game_${game.id}`;
      
      // Store player ID (simulating successful join)
      if (typeof window !== 'undefined') {
        localStorage.setItem(playerIdKey, player.id);
      }
      
      // Simulate player gets removed from database (disconnect)
      await testSupabase
        .from('players')
        .delete()
        .eq('id', player.id);
      
      // Check for inconsistency
      const storedPlayerId = typeof window !== 'undefined' ? 
        localStorage.getItem(playerIdKey) : null;
      
      const { data: playerInDb } = await testSupabase
        .from('players')
        .select('*')
        .eq('id', player.id)
        .single();
      
      // This reveals the inconsistency
      expect(storedPlayerId).toBe(player.id); // localStorage still has player
      expect(playerInDb).toBeNull(); // But player is gone from database
      
      // Cleanup
      if (typeof window !== 'undefined') {
        localStorage.removeItem(playerIdKey);
      }
    });
  });

  describe('Multi-Player Coordination Edge Cases', () => {
    test('simultaneous player ready state changes cause coordination issues', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Create multiple players
      const players = await Promise.all([
        createTestPlayer(game.id, { is_ready: false }),
        createTestPlayer(game.id, { is_ready: false }),
        createTestPlayer(game.id, { is_ready: false })
      ]);
      
      // Track subscription notifications
      const notifications: any[] = [];
      const channel = testSupabase
        .channel(`coordination-test-${game.id}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public' }, 
            (payload) => {
              notifications.push({
                table: payload.table,
                eventType: payload.eventType,
                timestamp: Date.now()
              });
            }
        );

      await channel.subscribe();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // All players toggle ready simultaneously
      const readyPromises = players.map(player => 
        testSupabase
          .from('players')
          .update({ is_ready: true })
          .eq('id', player.id)
      );
      
      await Promise.all(readyPromises);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check how many notifications were generated
      const playerNotifications = notifications.filter(n => n.table === 'players');
      console.log(`${players.length} players changed ready state, received ${playerNotifications.length} notifications`);
      
      // This can cause subscription flooding and state confusion
      expect(playerNotifications.length).toBeGreaterThanOrEqual(players.length);
      
      await testSupabase.removeChannel(channel);
    });

    test('ready player order updates during concurrent state changes', async () => {
      const game = await createTestGame({ ready_player_order: [] });
      const players = await Promise.all([
        createTestPlayer(game.id, { is_ready: false }),
        createTestPlayer(game.id, { is_ready: false })
      ]);
      
      // Simulate concurrent operations that update ready_player_order
      const operations = [
        // Player 1 becomes ready
        testSupabase
          .from('players')
          .update({ is_ready: true })
          .eq('id', players[0].id),
        
        // Update ready_player_order with player 1
        testSupabase
          .from('games')
          .update({ ready_player_order: [players[0].id] })
          .eq('id', game.id),
        
        // Player 2 becomes ready
        testSupabase
          .from('players')
          .update({ is_ready: true })
          .eq('id', players[1].id),
        
        // Update ready_player_order with both players
        testSupabase
          .from('games')
          .update({ ready_player_order: [players[0].id, players[1].id] })
          .eq('id', game.id)
      ];
      
      // Execute with some overlap
      await Promise.all([
        operations[0],
        operations[1]
      ]);
      
      await Promise.all([
        operations[2],
        operations[3]
      ]);
      
      // Check final consistency
      const { data: finalGame } = await testSupabase
        .from('games')
        .select('ready_player_order')
        .eq('id', game.id)
        .single();
      
      const { data: readyPlayers } = await testSupabase
        .from('players')
        .select('id, is_ready')
        .eq('game_id', game.id)
        .eq('is_ready', true);
      
      // The ready_player_order should match actual ready players
      expect(readyPlayers).toHaveLength(2);
      expect(finalGame.ready_player_order).toHaveLength(2);
      expect(finalGame.ready_player_order).toContain(players[0].id);
      expect(finalGame.ready_player_order).toContain(players[1].id);
    });
  });

  describe('Context State Management Issues', () => {
    test('refetchGameState timing during rapid database changes', async () => {
      const game = await createTestGame({ game_phase: 'lobby' });
      
      // Simulate rapid database changes that trigger multiple refetches
      const changes = [
        { transition_state: 'starting_game' },
        { game_phase: 'category_selection' },
        { current_round: 2 },
        { transition_state: 'idle' }
      ];
      
      const refetchTimes: number[] = [];
      
      // Apply changes rapidly
      for (const change of changes) {
        await testSupabase
          .from('games')
          .update(change)
          .eq('id', game.id);
        
        // Simulate refetchGameState call
        const startTime = Date.now();
        const { data } = await testSupabase
          .from('games')
          .select('*')
          .eq('id', game.id)
          .single();
        
        refetchTimes.push(Date.now() - startTime);
        
        expect(data).toBeDefined();
        
        // Small delay between changes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('Refetch times (ms):', refetchTimes);
      
      // Check that refetch times are reasonable (< 1000ms each)
      refetchTimes.forEach(time => {
        expect(time).toBeLessThan(1000);
      });
    });
  });
});