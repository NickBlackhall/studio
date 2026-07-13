"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, Suspense, startTransition } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getGame, getGameByRoomCode, getCurrentPlayerSession } from '@/app/game/actions';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import { useSearchParams, usePathname } from 'next/navigation';
import { installClientLogger, setLogContext } from '@/lib/clientLogger';

interface SharedGameContextType {
  gameState: GameClientState | null;
  thisPlayer: PlayerClientState | null;
  isInitializing: boolean;
  setGameState: (state: GameClientState | null) => void;
  setThisPlayer: (player: PlayerClientState | null) => void;
  initializeGame: () => Promise<void>;
  refetchGameState: () => Promise<void>;
  createNewGame: () => Promise<GameClientState>;
  joinGameByRoomCode: (roomCode: string) => Promise<GameClientState>;
}

const SharedGameContext = createContext<SharedGameContextType | undefined>(undefined);

function SharedGameProviderContent({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isMountedRef = useRef(true);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Live diagnostics: mirror tagged console output into client_logs so
  // gameplay issues can be diagnosed without players copying console text
  useEffect(() => {
    installClientLogger();
  }, []);
  useEffect(() => {
    setLogContext(searchParams?.get('room') ?? null, thisPlayer?.name ?? null);
  }, [searchParams, thisPlayer?.name]);

  // Debouncing for subscription updates
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dead-room detector. Rooms are now really deleted (host leaves, last player
  // out, master reset), and the teardown broadcast lives ~2.5s — shorter than
  // the 5s heartbeat — so a client can easily miss it and then refetch a row
  // that no longer exists. Without this, that client froze on the game screen
  // forever while its heartbeat errored.
  //
  // Distinguishes "room gone" from a network blip by asking for the row
  // directly: only a clean not-found ejects; a failed check does nothing.
  const ejectIfRoomDeleted = useCallback(async (gameId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id')
        .eq('id', gameId)
        .maybeSingle();
      if (!error && !data) {
        console.warn(`💀 SHARED_CONTEXT: Game ${gameId} no longer exists — returning to main menu`);
        localStorage.setItem('gameResetFlag', 'true');
        window.location.href = '/?step=menu';
        return true;
      }
    } catch {
      // Network hiccup: can't tell whether the room is gone, so stay put.
    }
    return false;
  }, []);

  const initializeGame = useCallback(async () => {
    console.log("SHARED_CONTEXT: initializeGame - Started");
    setIsInitializing(true);
    
    // CRITICAL: Block initialization during reset
    const resetFlag = typeof window !== 'undefined' ? localStorage.getItem('gameResetFlag') : null;
    if (resetFlag === 'true') {
      console.log('INIT: skipping initializeGame due to resetFlag');
      setIsInitializing(false);
      return;
    }
    
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured()) {
      console.error("SHARED_CONTEXT: Error initializing game: Supabase is not properly configured");
      console.log("SHARED_CONTEXT: Please check environment variables:");
      console.log("- NEXT_PUBLIC_SUPABASE_URL");
      console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY");
      setIsInitializing(false);
      return;
    }
    
    try {
      // Check for room code in URL parameters
      const roomCodeParam = searchParams?.get('room');
      let fetchedGameState: GameClientState;
      
      if (roomCodeParam) {
        // Clean the room code - remove any query parameters that might be attached
        const cleanRoomCode = roomCodeParam.split('?')[0].split('&')[0].trim().toUpperCase();
        console.log(`🔵 SHARED_CONTEXT: Room code found in URL: ${roomCodeParam} (cleaned: ${cleanRoomCode}) - Loading specific game`);
        fetchedGameState = await getGameByRoomCode(cleanRoomCode);
        console.log(`🔵 SHARED_CONTEXT: Loaded game ${fetchedGameState.gameId} via room code ${cleanRoomCode}`);
      } else {
        // No room in the URL: do NOT call getGame() — its no-argument path
        // find-or-CREATES a lobby, so every plain homepage visit was minting
        // an abandoned room (the "zombie room" graveyard).
        console.log("🔵 SHARED_CONTEXT: No room code in URL, skipping game load");
        if (isMountedRef.current) {
          setGameState(null);
          setThisPlayer(null);
          setIsInitializing(false);
        }
        return;
      }
      
      if (!isMountedRef.current) return;

      if (fetchedGameState?.gameId) {
        console.log(`🔵 SHARED_CONTEXT: Game ${fetchedGameState.gameId} loaded, phase: ${fetchedGameState.gamePhase}, players: ${fetchedGameState.players.length}`);
        setGameState(fetchedGameState);

        // SECURITY: Check for server-side session instead of localStorage
        try {
          const sessionData = await getCurrentPlayerSession();
          if (sessionData && sessionData.gameId === fetchedGameState.gameId) {
            const playerInGame = fetchedGameState.players.find(p => p.id === sessionData.playerId);
            if (playerInGame) {
              console.log(`🔵 SHARED_CONTEXT: Player ${sessionData.playerId} confirmed via session`);
              setThisPlayer(playerInGame);
            } else {
              console.log(`🟡 SHARED_CONTEXT: Player ${sessionData.playerId} not in game, session may be stale`);
              setThisPlayer(null);
            }
          } else {
            console.log(`🟡 SHARED_CONTEXT: No valid session or session for different game`);
            setThisPlayer(null);
          }
        } catch (error) {
          console.error(`🔴 SHARED_CONTEXT: Error checking player session:`, error);
          setThisPlayer(null);
        }
      } else {
        setGameState(null);
        setThisPlayer(null);
      }
    } catch (error) {
      console.error("SHARED_CONTEXT: Error initializing game:", error);
      setGameState(null);
      setThisPlayer(null);
    } finally {
      if (isMountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [searchParams]);

  const refetchGameState = useCallback(async () => {
    const currentGameId = gameState?.gameId;
    if (!currentGameId || !isMountedRef.current) {
      console.log(`SHARED_CONTEXT: refetchGameState skipped - gameId: ${currentGameId}, mounted: ${isMountedRef.current}`);
      return;
    }
    
    try {
      console.log(`SHARED_CONTEXT: refetchGameState for game ${currentGameId}`);
      const updatedGame = await getGame(currentGameId);
      
      if (updatedGame && isMountedRef.current) {
        console.log(`SHARED_CONTEXT: Updated game state - phase: ${updatedGame.gamePhase}, players: ${updatedGame.players.length}`);
        
        // Clear client-side transition state when server says transition is complete
        if (updatedGame.transitionState === 'idle' && gameState?.transitionState !== 'idle') {
          console.log(`🔵 SHARED_CONTEXT: Server completed transition - clearing client state (${gameState?.transitionState} → idle)`);
        }
        
        // Additional safety: clear transition state when game phase advances from lobby
        if (gameState?.gamePhase === 'lobby' && updatedGame.gamePhase !== 'lobby' && updatedGame.transitionState !== 'idle') {
          console.log('🔵 SHARED_CONTEXT: Game advanced from lobby but server transition not idle - forcing clear');
          updatedGame.transitionState = 'idle';
          updatedGame.transitionMessage = null;
        }
        
        setGameState(updatedGame);

        // Refresh thisPlayer (incl. isJudge) from the new state by id.
        // Functional update: reading thisPlayer directly here was a stale
        // closure (empty dependency array) that was permanently null, and
        // the localStorage key is never written anymore.
        setThisPlayer(prev =>
          prev ? (updatedGame.players.find(p => p.id === prev.id) ?? null) : prev
        );
      }
    } catch (error) {
      console.error('SHARED_CONTEXT: Error in refetchGameState:', error);
      void ejectIfRoomDeleted(currentGameId);
    }
  }, []); // Empty dependency array - uses current gameState via closure

  // The two teardown transitions go to different places (HOST_AND_RESET_SPEC.md):
  //
  //   returning_to_lobby — host ended the game. Players KEEP their seats, so send
  //                        them to this room's lobby, not out to the main menu.
  //   resetting_game     — the room is being torn down (host left, master reset).
  //                        Everyone out to the main menu.
  useEffect(() => {
    const transition = gameState?.transitionState;
    if (transition !== 'resetting_game' && transition !== 'returning_to_lobby') return;

    const roomCode = searchParams?.get('room');

    const timeoutId = setTimeout(() => {
      if (transition === 'returning_to_lobby' && roomCode) {
        console.log('🔄 SHARED_CONTEXT: Game ended - returning to this room\'s lobby');
        // No reset flag: the player is still in the room, so client state must NOT
        // be wiped. Hard nav so the lobby remounts against the fresh game row.
        window.location.href = `/?room=${roomCode}`;
        return;
      }

      console.log('🔄 SHARED_CONTEXT: Room torn down - navigating to main menu');
      localStorage.setItem('gameResetFlag', 'true');
      window.location.href = '/?step=menu';
    }, 2000); // let the transition overlay be seen

    return () => clearTimeout(timeoutId);
  }, [gameState?.transitionState, searchParams]);

  // Real-time subscription effect - STABLE (no dynamic dependencies)
  useEffect(() => {
    const gameId = gameState?.gameId;
    const isTransitioning = gameState?.transitionState !== 'idle' && gameState?.transitionState !== null;
    const subscriptionId = Math.random().toString(36).substr(2, 9);
    
    // CRITICAL: Block subscriptions during reset
    const resetFlag = localStorage.getItem('gameResetFlag');
    if (resetFlag === 'true') {
      console.log(`🔇 SUB_${subscriptionId}: resetFlag=TRUE → skip subscription setup`);
      return;
    }
    
    // Don't set up subscriptions if there's no game state or during reset scenarios
    if (!gameId || !isMountedRef.current) {
      console.log(`🔇 SUB_${subscriptionId}: Skipping subscription setup - gameId: ${gameId}, mounted: ${isMountedRef.current}`);
      return;
    }
    
    console.log(`🔥 SUB_${subscriptionId}: NEW SUBSCRIPTION EFFECT TRIGGERED - gameId: ${gameId}, transitionState: ${gameState?.transitionState}`)
    
    // Enhanced debugging for flickering investigation
    const debugFlickering = typeof window !== 'undefined' && localStorage.getItem('debugFlickering') === 'true';
    if (debugFlickering) {
      console.log(`🔍 SUB_${subscriptionId}: FLICKERING DEBUG - Current gameState:`, {
        gameId: gameState?.gameId,
        gamePhase: gameState?.gamePhase,
        transitionState: gameState?.transitionState,
        playerCount: gameState?.players?.length,
        thisPlayerId: thisPlayer?.id
      });
    }
    
    
    console.log(`🔵 SUB_${subscriptionId}: Setting up STABLE real-time subscription for game ${gameId}`);

    const channel = supabase
      .channel(`shared-game-updates-${gameId}-${subscriptionId}`)
      // TEMPORARY: Revert to broad subscription while debugging filter issue
      .on('postgres_changes', 
          { event: '*', schema: 'public' }, 
          (payload) => {
            // Type guard for payload records. For DELETE events the data is in
            // payload.old, not payload.new — previously deletes (e.g. a player
            // being removed) were always treated as irrelevant and dropped.
            const newRecord = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as any;
            console.log(`🔥 SUB_${subscriptionId}: Database update:`, payload.table, payload.eventType, 'gameId in payload:', newRecord?.game_id || newRecord?.id);
            
            // Only process if it's relevant to this game
            // BUGFIX: This previously checked 'submitted_cards' and 'round_results',
            // which are not real tables in this schema — so events on the actual
            // 'responses', 'winners', and 'player_hands' tables were discarded and
            // the UI only updated via incidental 'games' row updates.
            const isRelevant = 
              (payload.table === 'games' && newRecord?.id === gameId) ||
              (payload.table === 'players' && newRecord?.game_id === gameId) ||
              (payload.table === 'responses' && newRecord?.game_id === gameId) ||
              (payload.table === 'player_hands' && newRecord?.game_id === gameId) ||
              (payload.table === 'winners' && newRecord?.game_id === gameId);
            
            if (isRelevant) {
              console.log(`🎯 SUB_${subscriptionId}: RELEVANT update for game ${gameId} - ${payload.table}:${payload.eventType}`);
              handleSubscriptionUpdate(subscriptionId, gameId, payload, payload.table);
            } else {
              console.log(`🔇 SUB_${subscriptionId}: Ignoring irrelevant update - ${payload.table}:${payload.eventType}`);
            }
          }
      );

    // Extracted handler function to avoid code duplication
    const handleSubscriptionUpdate = (subId: string, gameId: string, payload: any, tableName: string) => {
      if (isMountedRef.current) {
        // Clear any pending subscription timeout to batch rapid updates
        if (subscriptionTimeoutRef.current) {
          clearTimeout(subscriptionTimeoutRef.current);
        }
        
        // Debounce subscription updates to batch rapid-fire database changes
        console.log(`🕒 SUB_${subId}: Debouncing subscription update (150ms delay) - Event: ${payload.eventType} on ${tableName}`);
        subscriptionTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          console.log(`🎯 SUB_${subId}: EXECUTING debounced update for game ${gameId} after 150ms delay`);
          
          // Call getGame directly to avoid closure dependencies
          getGame(gameId).then(updatedGame => {
            if (updatedGame && isMountedRef.current) {
              console.log(`🔵 SUB_${subId}: RECEIVED UPDATE - updating state - phase: ${updatedGame.gamePhase}, players: ${updatedGame.players.length}`);
              
              // Use startTransition to batch state updates and mark them as non-urgent
              startTransition(() => {
                setGameState(updatedGame);

                // CRITICAL: refresh thisPlayer from the new state by id.
                // The old localStorage lookup key is never written anymore
                // (session auth replaced it), so thisPlayer — including
                // isJudge — froze at its round-1 value: the old judge kept
                // JudgeView all game and the new judge never got it.
                setThisPlayer(prev =>
                  prev ? (updatedGame.players.find(p => p.id === prev.id) ?? null) : prev
                );
              });
            }
          }).catch(error => {
            console.error('SHARED_CONTEXT: Error in subscription refetch:', error);
          });
        }, 300); // Increased debounce to better batch rapid subscription events
      }
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`🔵 SUB_${subscriptionId}: ✅ Subscribed to STABLE updates for game ${gameId}`);
      }
    });

    return () => {
      console.log(`🚫 SUB_${subscriptionId}: Unsubscribing from STABLE updates for game ${gameId}`);
      
      // Clear any pending subscription timeout
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
      
      supabase.removeChannel(channel);
    };
  }, [gameState?.gameId]); // Only depend on gameId - transition state shouldn't recreate subscriptions

  // Heartbeat polling. Fast (500ms) during transitions; slow (5s) during
  // normal play. The slow heartbeat matters: realtime is the only other
  // state sync, so a single missed event left a client stale forever —
  // e.g. round 2 starting with a new judge while another player's screen
  // stayed frozen on round 1 ("the judge didn't change").
  useEffect(() => {
    const gameId = gameState?.gameId;
    const isTransitioning = gameState?.transitionState !== 'idle' && gameState?.transitionState !== null;

    // Heartbeat runs whenever we're viewing a game — no other preconditions.
    // (Gating on thisPlayer risked silencing it exactly when identity
    // resolution hiccuped, leaving screens permanently stale.) Stale tabs
    // whose session moved to a newer room are handled by the circuit
    // breaker below: auth rejections stop the polling for that tab.
    if (!gameId || !isMountedRef.current) {
      return;
    }

    const intervalMs = isTransitioning ? 500 : 5000;
    console.log(`🔄 HEARTBEAT_POLL: Setting up ${intervalMs}ms polling (transition: ${gameState?.transitionState})`);

    let authFailures = 0;
    const pollInterval = setInterval(() => {
      if (isMountedRef.current) {
        // Call getGame directly to avoid closure dependencies
        getGame(gameId).then(updatedGame => {
          if (updatedGame && isMountedRef.current) {
            authFailures = 0;
            setGameState(updatedGame);

            // Refresh thisPlayer (incl. isJudge) from the new state by id —
            // see subscription handler comment; localStorage key is dead.
            setThisPlayer(prev =>
              prev ? (updatedGame.players.find(p => p.id === prev.id) ?? null) : prev
            );
          }
        }).catch(error => {
          console.error('HEARTBEAT_POLL: Error in polling refetch:', error);
          // A deleted room and an auth failure both surface here as errors.
          // Check for the deleted room first — it must eject the player, not
          // just silence the heartbeat like the circuit breaker below does.
          void ejectIfRoomDeleted(gameId).then(gone => {
            if (gone) {
              clearInterval(pollInterval);
              return;
            }
            // Circuit breaker: this tab isn't a member of this game (session
            // belongs to another room, or was never established) — stop
            // hammering the server from this tab.
            authFailures++;
            if (authFailures >= 3) {
              console.warn('HEARTBEAT_POLL: repeated auth failures — stopping heartbeat for this tab');
              clearInterval(pollInterval);
            }
          });
        });
      }
    }, intervalMs);

    // Cleanup interval
    return () => {
      clearInterval(pollInterval);
    };
  }, [gameState?.gameId, gameState?.transitionState]);

  // A reset leaves gameResetFlag behind to tell the client to wipe its game state.
  //
  // This has to run on every arrival at a non-room screen, NOT just on mount. This
  // provider lives in the root layout, so a soft router.push() (which is how the
  // game page leaves for the menu) never remounts it. While this was mount-only the
  // flag survived forever — and a stuck flag silently blocks joining a room
  // (handleJoinRoom returns early) and skips realtime subscription setup, which is
  // how "clicking Join Room does nothing" happened.
  //
  // Keyed on pathname so the /game -> / navigation retriggers it; guarded on the
  // room param so we never wipe state for someone actually sitting in a room.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchParams?.get('room')) return;
    if (localStorage.getItem('gameResetFlag') !== 'true') return;

    console.log('🔄 SHARED_CONTEXT: Reset flag detected → clearing all client state');
    setGameState(null);
    setThisPlayer(null);
    localStorage.removeItem('gameResetFlag');
  }, [pathname, searchParams]);

  // Note: Automatic navigation removed to avoid circular dependencies
  // Pages should handle navigation based on shared game state

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only auto-initialize if there's a room code in the URL
    const roomCodeParam = searchParams?.get('room');
    if (roomCodeParam) {
      console.log(`SHARED_CONTEXT: Room code found in URL (${roomCodeParam}), auto-initializing game`);
      initializeGame();
    } else {
      console.log("SHARED_CONTEXT: No room code in URL, skipping auto-initialization");
      setIsInitializing(false);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [initializeGame, searchParams]);

  const createNewGame = useCallback(async (): Promise<GameClientState> => {
    console.log("SHARED_CONTEXT: createNewGame - Creating new game");
    setIsInitializing(true);
    
    try {
      // Create a new game by calling getGame without parameters (which creates a new lobby)
      const newGameState = await getGame();
      
      if (isMountedRef.current && newGameState?.gameId) {
        console.log(`SHARED_CONTEXT: Created new game ${newGameState.gameId}`);
        setGameState(newGameState);
        setIsInitializing(false);
        return newGameState;
      }
      throw new Error("Failed to create new game");
    } catch (error) {
      console.error("SHARED_CONTEXT: Error creating new game:", error);
      setIsInitializing(false);
      throw error;
    }
  }, []);

  const joinGameByRoomCode = useCallback(async (roomCode: string): Promise<GameClientState> => {
    // Clean the room code - remove any query parameters that might be attached
    const cleanRoomCode = roomCode.split('?')[0].split('&')[0].trim().toUpperCase();
    console.log(`SHARED_CONTEXT: joinGameByRoomCode - Joining game with code: ${roomCode} (cleaned: ${cleanRoomCode})`);
    setIsInitializing(true);
    
    try {
      const gameState = await getGameByRoomCode(cleanRoomCode);
      
      if (isMountedRef.current && gameState?.gameId) {
        console.log(`SHARED_CONTEXT: Joined game ${gameState.gameId} via room code ${cleanRoomCode}`);
        setGameState(gameState);
        setIsInitializing(false);
        return gameState;
      }
      throw new Error(`Failed to join game with room code: ${cleanRoomCode}`);
    } catch (error) {
      console.error(`SHARED_CONTEXT: Error joining game with room code ${cleanRoomCode}:`, error);
      setIsInitializing(false);
      throw error;
    }
  }, []);

  const value = {
    gameState,
    thisPlayer,
    isInitializing,
    setGameState,
    setThisPlayer,
    initializeGame,
    refetchGameState,
    createNewGame,
    joinGameByRoomCode,
  };

  return (
    <SharedGameContext.Provider value={value}>
      {children}
    </SharedGameContext.Provider>
  );
}

export function SharedGameProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-grow flex items-center justify-center bg-black"><div className="text-white">Loading game...</div></div>}>
      <SharedGameProviderContent>
        {children}
      </SharedGameProviderContent>
    </Suspense>
  );
}

export function useSharedGame() {
  const context = useContext(SharedGameContext);
  if (context === undefined) {
    throw new Error('useSharedGame must be used within a SharedGameProvider');
  }
  return context;
}