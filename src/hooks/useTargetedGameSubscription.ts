
"use client";

import { useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState } from '@/lib/types';
import { getGame } from '@/app/game/actions';

interface UseTargetedGameSubscriptionProps {
  gameId: string | null;
  setGameState: React.Dispatch<React.SetStateAction<GameClientState | null>>;
}

export function useTargetedGameSubscription({
  gameId,
  setGameState,
}: UseTargetedGameSubscriptionProps) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const debouncedRefetch = useCallback(
    debounce(async (gId: string) => {
      if (!isMountedRef.current || !gId) return;
      
      const updatedGameState = await getGame(gId);
      if (isMountedRef.current) {
        setGameState(updatedGameState);
      }
    }, 300), 
    [setGameState] // setGameState is stable
  );

  useEffect(() => {
    if (!gameId) {
      return;
    }

    const handleChanges = () => {
      debouncedRefetch(gameId);
    };

    const channel = supabase
      .channel(`game-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `game_id=eq.${gameId}`}, handleChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameId}` }, handleChanges)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to targeted updates for game ${gameId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Real-time subscription error for game ${gameId}:`, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      debouncedRefetch.cancel();
    };
  }, [gameId, debouncedRefetch]);
}
