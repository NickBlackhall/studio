
"use client";

import { useEffect, useCallback, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import { getCurrentPlayer } from '@/app/game/actions';
import type { Tables } from '@/lib/database.types';

type SetGameState = (
  newState: GameClientState | null | ((prevState: GameClientState | null) => GameClientState | null)
) => void;

type SetThisPlayer = (
  newPlayerState: PlayerClientState | null | ((prevState: PlayerClientState | null) => PlayerClientState | null)
) => void;

export function useTargetedGameSubscription(
  gameId: string | undefined, 
  setGameState: SetGameState,
  setThisPlayer?: SetThisPlayer
) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleGameUpdate = useCallback((payload: RealtimePostgresChangesPayload<Tables<'games'>>) => {
    if (!isMountedRef.current) return;
    const updatedGame = payload.new as Tables<'games'>;

    setGameState(prev => {
      if (!prev || prev.gameId !== updatedGame.id) return prev;
      
      return {
        ...prev,
        gamePhase: updatedGame.game_phase as GameClientState['gamePhase'],
        currentRound: updatedGame.current_round,
        currentJudgeId: updatedGame.current_judge_id,
        currentScenario: updatedGame.current_scenario_id === prev.currentScenario?.id ? prev.currentScenario : null, // Needs refetch
        lastWinner: updatedGame.last_round_winner_player_id ? prev.lastWinner : undefined, // Needs refetch
        winningPlayerId: updatedGame.overall_winner_player_id,
        ready_player_order: updatedGame.ready_player_order || [],
        transitionState: updatedGame.transition_state as GameClientState['transitionState'],
        transitionMessage: updatedGame.transition_message,
        // If a significant change happens, a full refetch might be needed.
        // This simple update avoids flickers on minor changes.
      };
    });
  }, [setGameState]);

  const handlePlayersUpdate = useCallback((payload: RealtimePostgresChangesPayload<Tables<'players'>>) => {
    if (!isMountedRef.current) return;
    const updatedPlayer = payload.new as Tables<'players'>;
    
    setGameState(prev => {
        if (!prev) return prev;

        const playerExists = prev.players.some(p => p.id === updatedPlayer.id);
        let newPlayersList;

        if (playerExists) {
            newPlayersList = prev.players.map(p => 
                p.id === updatedPlayer.id 
                ? { ...p, name: updatedPlayer.name, avatar: updatedPlayer.avatar, score: updatedPlayer.score, isReady: updatedPlayer.is_ready }
                : p
            );
        } else {
            // New player joined
            newPlayersList = [
                ...prev.players, 
                {
                    id: updatedPlayer.id,
                    name: updatedPlayer.name,
                    avatar: updatedPlayer.avatar,
                    score: updatedPlayer.score,
                    isJudge: prev.currentJudgeId === updatedPlayer.id,
                    hand: [], // Hand data is fetched separately
                    isReady: updatedPlayer.is_ready
                }
            ];
        }
        return { ...prev, players: newPlayersList };
    });
  }, [setGameState]);

  const handleSubmissionUpdate = useCallback(async (payload: RealtimePostgresChangesPayload<Tables<'responses'>>) => {
      if (!isMountedRef.current || payload.eventType !== 'INSERT') return;
      const newSubmission = payload.new as Tables<'responses'>;

      const cardText = newSubmission.submitted_text || (await getCardText(newSubmission.response_card_id));
      
      setGameState(prev => {
          if (!prev) return prev;
          const submissionExists = prev.submissions.some(s => s.playerId === newSubmission.player_id && s.cardId === (newSubmission.response_card_id || `custom-${newSubmission.player_id}`));
          if (submissionExists) return prev;

          return {
              ...prev,
              submissions: [
                  ...prev.submissions,
                  {
                      playerId: newSubmission.player_id,
                      cardId: newSubmission.response_card_id || `custom-${newSubmission.player_id}-${newSubmission.round_number}`,
                      cardText: cardText || "Error fetching text",
                  }
              ]
          };
      });
  }, [setGameState]);
  
  const handlePlayerHandUpdate = useCallback(async (payload: RealtimePostgresChangesPayload<any>) => {
    if (!isMountedRef.current || !setThisPlayer) return;

    const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameId}`);
    const isForThisPlayer = payload.new.player_id === playerIdFromStorage;
    
    if (isForThisPlayer) {
      const playerDetails = await getCurrentPlayer(playerIdFromStorage!, gameId!);
      if (playerDetails && isMountedRef.current) {
        setThisPlayer(playerDetails);
      }
    }
  }, [gameId, setThisPlayer]);

  useEffect(() => {
    if (!gameId) return;

    const gameChanges = supabase
      .channel(`game-updates-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handleGameUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, handlePlayersUpdate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: `game_id=eq.${gameId}`}, handleSubmissionUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameId}` }, handlePlayerHandUpdate)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to targeted updates for game ${gameId}`);
        }
        if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Real-time subscription error for game ${gameId}:`, err);
        }
      });

    return () => {
      supabase.removeChannel(gameChanges);
    };
  }, [gameId, handleGameUpdate, handlePlayersUpdate, handleSubmissionUpdate, handlePlayerHandUpdate]);
}

// Helper to get card text on demand for submissions
async function getCardText(cardId: string | null): Promise<string | null> {
    if (!cardId) return null;
    const { data, error } = await supabase
        .from('response_cards')
        .select('text')
        .eq('id', cardId)
        .single();
    if (error) return "Card text not found";
    return data.text;
}
