
"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { GameClientState } from '@/lib/types';
import { useLoading } from '@/contexts/LoadingContext';

interface UseGameNavigationProps {
  gameState: GameClientState | null;
  thisPlayerId: string | null;
  currentPath: string;
}

export function useGameNavigation({ gameState, thisPlayerId, currentPath }: UseGameNavigationProps) {
  const router = useRouter();
  const { showLoader, hideLoader, isLoading } = useLoading();
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameState || !gameState.gameId || !isMountedRef.current || isLoading) return;

    // Check if the current user is part of the game's player list.
    const isPlayerInGame = thisPlayerId && gameState.players.some(p => p.id === thisPlayerId);

    // Condition to navigate TO the game.
    const shouldNavigateToGame = 
      gameState.gamePhase !== 'lobby' &&
      isPlayerInGame &&
      currentPath !== '/game';

    // Condition to navigate FROM the game back to the lobby.
    const shouldNavigateToLobby = 
      gameState.gamePhase === 'lobby' &&
      isPlayerInGame &&
      currentPath !== '/' &&
      !currentPath.includes('step=setup');

    if (shouldNavigateToGame) {
      showLoader('navigation', { message: 'Joining game...' });
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/game');
          // Loader is hidden by the destination page's useEffect.
        }
      }, 150); // Small delay to allow loader to appear
    } else if (shouldNavigateToLobby) {
      showLoader('navigation', { message: 'Returning to lobby...' });
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/?step=setup');
        }
      }, 150);
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [gameState, thisPlayerId, currentPath, router, showLoader, hideLoader, isLoading]);
}
