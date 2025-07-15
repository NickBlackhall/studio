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
  const { showLoader, hideLoader } = useLoading();
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
    if (!gameState || !gameState.gameId || !isMountedRef.current) return;

    const shouldNavigateToGame = 
      gameState.transitionState === 'idle' &&
      gameState.gamePhase !== 'lobby' &&
      thisPlayerId &&
      currentPath !== '/game';

    const shouldNavigateToLobby = 
      gameState.gamePhase === 'lobby' &&
      currentPath !== '/' &&
      !currentPath.includes('step=setup');

    if (shouldNavigateToGame) {
      showLoader('navigation', { message: 'Loading game...' });
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/game');
          // Hide loader after a short delay to allow page to load
          setTimeout(() => {
            if (isMountedRef.current) hideLoader();
          }, 500);
        }
      }, 100);
    } else if (shouldNavigateToLobby) {
      showLoader('navigation', { message: 'Returning to lobby...' });
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/?step=setup');
          setTimeout(() => {
            if (isMountedRef.current) hideLoader();
          }, 500);
        }
      }, 100);
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [gameState, thisPlayerId, currentPath, router, showLoader, hideLoader]);
}