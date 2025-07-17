
"use client";

import { useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState } from '@/lib/types';
import { getGame } from '@/app/game/actions';

interface UseTargetedGameSubscriptionProps {
  gameId: string | null;
  setGameState: React.Dispatch<React.SetStateAction<GameClientState | null>>;
  isMountedRef: React.RefObject<boolean>;
}

export function useTargetedGameSubscription({
  gameId,
  setGameState,
  isMountedRef,
}: UseTargetedGameSubscriptionProps) {

  const debouncedRefetch = useCallback(
    debounce(async (gId: string) => {
      if (!isMountedRef.current || !gId) {
        console.log(`SUB_HOOK: Debounced refetch skipped. Mounted: ${isMountedRef.current}, GameID: ${gId}`);
        return;
      }
      
      console.log(`SUB_HOOK: Debounced refetch triggered for game ${gId}.`);
      const updatedGameState = await getGame(gId);
      
      if (isMountedRef.current) {
        console.log(`SUB_HOOK: Setting new game state. Phase: ${updatedGameState.gamePhase}`);
        setGameState(updatedGameState);
      }
    }, 300), 
    [setGameState, isMountedRef]
  );

  useEffect(() => {
    if (!gameId) {
      return;
    }

    const handleChanges = (payload: any) => {
      console.log(`SUB_HOOK: Change detected on table '${payload.table}'. Triggering debounced refetch.`);
      debouncedRefetch(gameId);
    };

    const channel = supabase
      .channel(`game-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `game_id=eq.${gameId}` }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameId}` }, handleChanges)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ SUB_HOOK: Subscribed to targeted updates for game ${gameId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(`🔴 SUB_HOOK: Real-time subscription error for game ${gameId}:`, err);
        }
      });

    return () => {
      console.log(`SUB_HOOK: Unsubscribing from game ${gameId} updates.`);
      supabase.removeChannel(channel);
      debouncedRefetch.cancel();
    };
  }, [gameId, debouncedRefetch]);
}
