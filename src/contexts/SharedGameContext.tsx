"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, Suspense, startTransition } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getGame, getGameByRoomCode } from '@/app/game/actions';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import { useSearchParams } from 'next/navigation';

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
  
  // Debouncing for subscription updates
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log(`🔵 SHARED_CONTEXT: Room code found in URL: ${roomCodeParam} - Loading specific game`);
        fetchedGameState = await getGameByRoomCode(roomCodeParam);
        console.log(`🔵 SHARED_CONTEXT: Loaded game ${fetchedGameState.gameId} via room code ${roomCodeParam}`);
      } else {
        console.log("🔵 SHARED_CONTEXT: No room code in URL, using default game loading");
        fetchedGameState = await getGame();
        console.log(`🔵 SHARED_CONTEXT: Loaded default game ${fetchedGameState.gameId}`);
      }
      
      if (!isMountedRef.current) return;

      if (fetchedGameState?.gameId) {
        console.log(`🔵 SHARED_CONTEXT: Game ${fetchedGameState.gameId} loaded, phase: ${fetchedGameState.gamePhase}, players: ${fetchedGameState.players.length}`);
        setGameState(fetchedGameState);

        // Check for stored player ID
        const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${fetchedGameState.gameId}`);
        if (playerIdFromStorage) {
          const playerInGame = fetchedGameState.players.find(p => p.id === playerIdFromStorage);
          if (playerInGame) {
            console.log(`SHARED_CONTEXT: Player ${playerIdFromStorage} confirmed`);
            setThisPlayer(playerInGame);
          } else {
            console.log(`SHARED_CONTEXT: Player ${playerIdFromStorage} not in game, clearing storage`);
            localStorage.removeItem(`thisPlayerId_game_${fetchedGameState.gameId}`);
            setThisPlayer(null);
          }
        } else {
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
        
        // Check for stored player ID even if thisPlayer doesn't exist yet
        const storedPlayerId = typeof window !== 'undefined' ? 
          localStorage.getItem(`thisPlayerId_game_${updatedGame.gameId}`) : null;
        
        if (storedPlayerId) {
          const playerDetail = updatedGame.players.find(p => p.id === storedPlayerId);
          console.log(`SHARED_CONTEXT: Looking for stored player ${storedPlayerId}, found: ${!!playerDetail}`);
          if (playerDetail) {
            console.log(`SHARED_CONTEXT: Setting thisPlayer to ${playerDetail.name} (${playerDetail.id})`);
            setThisPlayer(playerDetail);
          } else {
            console.log(`SHARED_CONTEXT: Stored player ${storedPlayerId} not found in game, clearing storage`);
            localStorage.removeItem(`thisPlayerId_game_${updatedGame.gameId}`);
            setThisPlayer(null);
          }
        } else if (thisPlayer?.id) {
          // Fallback: update existing player
          const playerDetail = updatedGame.players.find(p => p.id === thisPlayer.id);
          console.log(`SHARED_CONTEXT: Updating existing player ${thisPlayer.id}, found: ${!!playerDetail}`);
          setThisPlayer(playerDetail || null);
        }
      }
    } catch (error) {
      console.error('SHARED_CONTEXT: Error in refetchGameState:', error);
    }
  }, []); // Empty dependency array - uses current gameState via closure

  // Handle automatic navigation for reset transition
  useEffect(() => {
    if (gameState?.transitionState === 'resetting_game') {
      console.log('🔄 SHARED_CONTEXT: Reset transition detected - scheduling navigation to main menu');
      
      // Wait for the transition overlay to be visible, then navigate
      const timeoutId = setTimeout(() => {
        console.log('🔄 SHARED_CONTEXT: Navigating to main menu after reset');
        // Set reset flag to ensure clean state
        localStorage.setItem('gameResetFlag', 'true');
        // Use window.location for hard navigation to ensure clean state
        window.location.href = '/?step=menu';
      }, 2000); // Give 2 seconds to see the reset message
      
      return () => clearTimeout(timeoutId);
    }
  }, [gameState?.transitionState]);

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
      .on('postgres_changes', 
          { event: '*', schema: 'public' }, 
          (payload) => {
            console.log(`🔵 SUB_${subscriptionId}: Real-time update received for game ${gameId}:`, payload.eventType, payload.table);
            
            // Only refetch if it's actually relevant to this game
            const shouldRefetch = 
              payload.table === 'games' ||  // Game state changes
              payload.table === 'players' ||  // Player changes  
              payload.table === 'submitted_cards' ||  // Card submissions
              payload.table === 'round_results';  // Round results
            
            if (shouldRefetch && isMountedRef.current) {
              // Clear any pending subscription timeout to batch rapid updates
              if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
              }
              
              // Debounce subscription updates to batch rapid-fire database changes
              console.log(`🕒 SUB_${subscriptionId}: Debouncing subscription update (150ms delay) - Event: ${payload.eventType} on ${payload.table}`);
              subscriptionTimeoutRef.current = setTimeout(() => {
                if (!isMountedRef.current) return;
                console.log(`🎯 SUB_${subscriptionId}: EXECUTING debounced update for game ${gameId} after 150ms delay`);
                
                // Call getGame directly to avoid closure dependencies
                getGame(gameId).then(updatedGame => {
                  if (updatedGame && isMountedRef.current) {
                    // CRITICAL: Only update state if data actually changed
                    const currentState = gameState;
                    const hasActualChanges = !currentState || 
                      updatedGame.gamePhase !== currentState.gamePhase ||
                      updatedGame.transitionState !== currentState.transitionState ||
                      updatedGame.players.length !== currentState.players.length ||
                      JSON.stringify(updatedGame.players.map(p => ({ id: p.id, isReady: p.isReady, name: p.name }))) !== 
                      JSON.stringify(currentState.players.map(p => ({ id: p.id, isReady: p.isReady, name: p.name })));
                    
                    if (hasActualChanges) {
                      console.log(`🔵 SUB_${subscriptionId}: ACTUAL CHANGE DETECTED - updating state - phase: ${updatedGame.gamePhase}, players: ${updatedGame.players.length}`);
                      
                      // Use startTransition to batch state updates and mark them as non-urgent
                      startTransition(() => {
                        setGameState(updatedGame);
                        
                        // Update thisPlayer if needed
                        const storedPlayerId = localStorage.getItem(`thisPlayerId_game_${gameId}`);
                        if (storedPlayerId) {
                          const playerDetail = updatedGame.players.find(p => p.id === storedPlayerId);
                          if (playerDetail) {
                            setThisPlayer(playerDetail);
                          }
                        }
                      });
                    } else {
                      console.log(`🔇 SUB_${subscriptionId}: No meaningful changes detected - skipping state update`);
                    }
                  }
                }).catch(error => {
                  console.error('SHARED_CONTEXT: Error in subscription refetch:', error);
                });
              }, 150); // 150ms debounce to batch rapid subscription events
            } else {
              console.log(`🔇 SUB_${subscriptionId}: Ignoring irrelevant update for table: ${payload.table}`);
            }
          }
      )
      .subscribe((status) => {
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

  // Separate effect for transition polling to avoid subscription recreation
  useEffect(() => {
    const gameId = gameState?.gameId;
    const isTransitioning = gameState?.transitionState !== 'idle' && gameState?.transitionState !== null;
    
    if (!gameId || !isTransitioning || !isMountedRef.current) {
      return;
    }
    
    console.log(`🔄 TRANSITION_POLL: Setting up polling during transition (${gameState?.transitionState})`);
    
    // Poll every 500ms during transitions to catch completion
    const pollInterval = setInterval(() => {
      if (isMountedRef.current) {
        console.log(`🔄 TRANSITION_POLL: Polling for transition completion...`);
        // Call getGame directly to avoid closure dependencies
        getGame(gameId).then(updatedGame => {
          if (updatedGame && isMountedRef.current) {
            setGameState(updatedGame);
            
            // Update thisPlayer if needed
            const storedPlayerId = localStorage.getItem(`thisPlayerId_game_${gameId}`);
            if (storedPlayerId) {
              const playerDetail = updatedGame.players.find(p => p.id === storedPlayerId);
              if (playerDetail) {
                setThisPlayer(playerDetail);
              }
            }
          }
        }).catch(error => {
          console.error('TRANSITION_POLL: Error in polling refetch:', error);
        });
      }
    }, 500);
    
    // Cleanup interval
    return () => {
      console.log(`🔇 TRANSITION_POLL: Clearing transition polling`);
      clearInterval(pollInterval);
    };
  }, [gameState?.gameId, gameState?.transitionState]);

  // CRITICAL: Clear state when reset flag is present - check on every render
  useEffect(() => {
    const resetFlag = localStorage.getItem('gameResetFlag');
    if (resetFlag === 'true') {
      console.log('🔄 SHARED_CONTEXT: Reset flag detected → clearing all client state');
      setGameState(null);
      setThisPlayer(null);
      // Clear the flag immediately to prevent re-triggering
      localStorage.removeItem('gameResetFlag');
    }
  }, []); // Only run once on mount

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
    console.log(`SHARED_CONTEXT: joinGameByRoomCode - Joining game with code: ${roomCode}`);
    setIsInitializing(true);
    
    try {
      const gameState = await getGameByRoomCode(roomCode);
      
      if (isMountedRef.current && gameState?.gameId) {
        console.log(`SHARED_CONTEXT: Joined game ${gameState.gameId} via room code ${roomCode}`);
        setGameState(gameState);
        setIsInitializing(false);
        return gameState;
      }
      throw new Error(`Failed to join game with room code: ${roomCode}`);
    } catch (error) {
      console.error(`SHARED_CONTEXT: Error joining game with room code ${roomCode}:`, error);
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