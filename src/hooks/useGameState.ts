"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import { getGame, getCurrentPlayer } from '@/app/game/actions';
import { useLoading } from '@/contexts/LoadingContext';

export function useGameState() {
  const [gameState, setGameStateInternal] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayerInternal] = useState<PlayerClientState | null>(null);
  const gameStateRef = useRef<GameClientState | null>(null);
  const thisPlayerRef = useRef<PlayerClientState | null>(null);
  const isMountedRef = useRef(true);
  const { showLoader, hideLoader } = useLoading();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setGameState = useCallback((newState: GameClientState | null) => {
    gameStateRef.current = newState;
    if (isMountedRef.current) {
      setGameStateInternal(newState);
    }
  }, []);

  const setThisPlayer = useCallback((newPlayer: PlayerClientState | null) => {
    thisPlayerRef.current = newPlayer;
    if (isMountedRef.current) {
      setThisPlayerInternal(newPlayer);
    }
  }, []);

  const fetchGameAndPlayer = useCallback(async (gameId?: string, showLoading = true) => {
    if (showLoading) {
      showLoader('loading_game_data', { message: 'Loading game data...' });
    }

    try {
      const gameData = await getGame(gameId);
      if (!isMountedRef.current) return;

      if (!gameData?.gameId) {
        setGameState(null);
        setThisPlayer(null);
        return;
      }

      setGameState(gameData);

      // Handle player identification
      const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameData.gameId}`);
      
      if (playerIdFromStorage) {
        const playerInGame = gameData.players.find(p => p.id === playerIdFromStorage);
        if (playerInGame) {
          setThisPlayer(playerInGame);
        } else {
          // Player not in game, try to fetch from database
          const playerDetail = await getCurrentPlayer(playerIdFromStorage, gameData.gameId);
          if (playerDetail && isMountedRef.current) {
            setThisPlayer({ ...playerDetail, hand: playerDetail.hand || [] });
          } else {
            localStorage.removeItem(`thisPlayerId_game_${gameData.gameId}`);
            setThisPlayer(null);
          }
        }
      } else {
        setThisPlayer(null);
      }

    } catch (error) {
      console.error('Error fetching game data:', error);
      if (isMountedRef.current) {
        setGameState(null);
        setThisPlayer(null);
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        hideLoader();
      }
    }
  }, [setGameState, setThisPlayer, showLoader, hideLoader]);

  return {
    gameState,
    thisPlayer,
    gameStateRef,
    thisPlayerRef,
    setGameState,
    setThisPlayer,
    fetchGameAndPlayer,
  };
}