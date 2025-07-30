"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getGame } from '@/app/game/actions';
import type { GameClientState, PlayerClientState } from '@/lib/types';

interface SharedGameContextType {
  gameState: GameClientState | null;
  thisPlayer: PlayerClientState | null;
  isInitializing: boolean;
  setGameState: (state: GameClientState | null) => void;
  setThisPlayer: (player: PlayerClientState | null) => void;
  initializeGame: () => Promise<void>;
  refetchGameState: () => Promise<void>;
}

const SharedGameContext = createContext<SharedGameContextType | undefined>(undefined);

export function SharedGameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isMountedRef = useRef(true);

  const initializeGame = useCallback(async () => {
    console.log("SHARED_CONTEXT: initializeGame - Started");
    setIsInitializing(true);
    
    try {
      const fetchedGameState = await getGame();
      if (!isMountedRef.current) return;

      if (fetchedGameState?.gameId) {
        console.log(`SHARED_CONTEXT: Game ${fetchedGameState.gameId} loaded, phase: ${fetchedGameState.gamePhase}`);
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
  }, []);

  const refetchGameState = useCallback(async () => {
    if (!gameState?.gameId || !isMountedRef.current) return;
    
    try {
      console.log(`SHARED_CONTEXT: refetchGameState for game ${gameState.gameId}`);
      const updatedGame = await getGame(gameState.gameId);
      
      if (updatedGame && isMountedRef.current) {
        console.log(`SHARED_CONTEXT: Updated game state - phase: ${updatedGame.gamePhase}, players: ${updatedGame.players.length}`);
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
    if (!gameId || !isMountedRef.current) return;

    console.log(`SHARED_CONTEXT: Setting up real-time subscription for game ${gameId}`);

    const channel = supabase
      .channel(`shared-game-updates-${gameId}`)
      .on('postgres_changes', 
          { event: '*', schema: 'public' }, 
          () => {
            if (isMountedRef.current) {
              refetchGameState();
            }
          }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`SHARED_CONTEXT: Subscribed to real-time updates for game ${gameId}`);
        }
      });

    return () => {
      console.log(`SHARED_CONTEXT: Unsubscribing from real-time updates for game ${gameId}`);
      supabase.removeChannel(channel);
    };
  }, [gameState?.gameId, refetchGameState]);

  // Note: Automatic navigation removed to avoid circular dependencies
  // Pages should handle navigation based on shared game state

  useEffect(() => {
    isMountedRef.current = true;
    initializeGame();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [initializeGame]);

  const value = {
    gameState,
    thisPlayer,
    isInitializing,
    setGameState,
    setThisPlayer,
    initializeGame,
    refetchGameState,
  };

  return (
    <SharedGameContext.Provider value={value}>
      {children}
    </SharedGameContext.Provider>
  );
}

export function useSharedGame() {
  const context = useContext(SharedGameContext);
  if (context === undefined) {
    throw new Error('useSharedGame must be used within a SharedGameProvider');
  }
  return context;
}