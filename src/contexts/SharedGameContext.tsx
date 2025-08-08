"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, Suspense } from 'react';
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

  const initializeGame = useCallback(async () => {
    console.log("SHARED_CONTEXT: initializeGame - Started");
    setIsInitializing(true);
    
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
    if (!gameState?.gameId || !isMountedRef.current) {
      console.log(`SHARED_CONTEXT: refetchGameState skipped - gameId: ${gameState?.gameId}, mounted: ${isMountedRef.current}`);
      return;
    }
    
    try {
      console.log(`SHARED_CONTEXT: refetchGameState for game ${gameState.gameId}`);
      const updatedGame = await getGame(gameState.gameId);
      
      if (updatedGame && isMountedRef.current && gameState) {
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
  }, [gameState?.gameId, thisPlayer?.id]);

  // Real-time subscription effect
  useEffect(() => {
    const gameId = gameState?.gameId;
    const isTransitioning = gameState?.transitionState !== 'idle' && gameState?.transitionState !== null;
    
    // Don't set up subscriptions if there's no game state or during reset scenarios
    if (!gameId || !isMountedRef.current || !gameState) {
      console.log(`🔇 SHARED_CONTEXT: Skipping subscription setup - gameId: ${gameId}, mounted: ${isMountedRef.current}, gameState: ${!!gameState}`);
      return;
    }
    
    if (isTransitioning) {
      console.log(`🔇 SHARED_CONTEXT: Setting up polling during transition (${gameState?.transitionState})`);
      
      // Poll every 500ms during transitions to catch completion
      const pollInterval = setInterval(() => {
        if (isMountedRef.current && gameState) {
          console.log(`🔄 SHARED_CONTEXT: Polling for transition completion...`);
          refetchGameState();
        }
      }, 500);
      
      // Cleanup interval
      return () => {
        console.log(`🔇 SHARED_CONTEXT: Clearing transition polling`);
        clearInterval(pollInterval);
      };
    }
    
    console.log(`🔵 SHARED_CONTEXT: Transition check - transitionState: ${gameState?.transitionState}, isTransitioning: ${isTransitioning}`);

    console.log(`🔵 SHARED_CONTEXT: Setting up real-time subscription for game ${gameId}`);

    const channel = supabase
      .channel(`shared-game-updates-${gameId}`)
      .on('postgres_changes', 
          { event: '*', schema: 'public' }, 
          (payload) => {
            console.log(`🔵 SHARED_CONTEXT: Real-time update received for game ${gameId}:`, payload.eventType, payload.table);
            // Extra check to ensure we still have valid game state before processing updates
            if (isMountedRef.current && gameState) {
              refetchGameState();
            } else {
              console.log(`🔇 SHARED_CONTEXT: Ignoring real-time update - component unmounted or gameState cleared`);
            }
          }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`🔵 SHARED_CONTEXT: ✅ Subscribed to real-time updates for game ${gameId}`);
        }
      });

    return () => {
      console.log(`SHARED_CONTEXT: Unsubscribing from real-time updates for game ${gameId}`);
      supabase.removeChannel(channel);
    };
  }, [gameState?.gameId, gameState?.transitionState, refetchGameState]);

  // Note: Automatic navigation removed to avoid circular dependencies
  // Pages should handle navigation based on shared game state

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check for reset flag and clear state if found - this takes priority over URL params
    const resetFlag = localStorage.getItem('gameResetFlag');
    if (resetFlag === 'true') {
      console.log('🔄 SHARED_CONTEXT: Reset flag detected, clearing all game state and preventing auto-reconnection');
      localStorage.removeItem('gameResetFlag');
      
      // Clear all possible game-related localStorage entries
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('thisPlayerId_game_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Force cleanup of any existing subscriptions first
      try {
        supabase.removeAllChannels();
        console.log('🔄 SHARED_CONTEXT: Force-cleared all Supabase channels');
      } catch (error) {
        console.log('🔄 SHARED_CONTEXT: Error clearing channels (expected):', error);
      }
      
      setGameState(null);
      setThisPlayer(null);
      setIsInitializing(false);
      
      // Force URL change to remove room code if present
      const roomCodeParam = searchParams?.get('room');
      if (roomCodeParam) {
        console.log('🔄 SHARED_CONTEXT: Removing room code from URL after reset');
        // Use window.history to avoid triggering navigation effects
        window.history.replaceState(null, '', '/?step=menu');
      }
      
      return;
    }
    
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