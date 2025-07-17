
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
  const { showLoader, isLoading } = useLoading();
  const navigationLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!gameState || !gameState.gameId || !isMountedRef.current || isLoading || navigationLockRef.current) {
        if(isLoading || navigationLockRef.current) console.log("NAV_HOOK: Skipping navigation due to loading or lock.");
        return;
    }

    const isPlayerInGame = thisPlayerId && gameState.players.some(p => p.id === thisPlayerId);
    console.log(`NAV_HOOK: Running check. Path: ${currentPath}, Phase: ${gameState.gamePhase}, PlayerInGame: ${isPlayerInGame}`);

    const shouldNavigateToGame = gameState.gamePhase !== 'lobby' && isPlayerInGame && currentPath !== '/game';
    const shouldNavigateToLobby = gameState.gamePhase === 'lobby' && isPlayerInGame && currentPath !== '/' && !currentPath.includes('step=setup');

    if (shouldNavigateToGame) {
      console.log("NAV_HOOK: Condition MET to navigate TO GAME. Locking and navigating.");
      navigationLockRef.current = true;
      showLoader('navigation', { message: 'Joining game...' });
      
      setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/game');
          // No need to unlock here, page change will unmount this instance
        }
      }, 150);
    } else if (shouldNavigateToLobby) {
      console.log("NAV_HOOK: Condition MET to navigate TO LOBBY. Locking and navigating.");
      navigationLockRef.current = true;
      showLoader('navigation', { message: 'Returning to lobby...' });
      
      setTimeout(() => {
        if (isMountedRef.current) {
          router.push('/?step=setup');
        }
      }, 150);
    }

  }, [gameState, thisPlayerId, currentPath, router, showLoader, isLoading]);
}
