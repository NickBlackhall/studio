"use client";

import React from 'react';
import { MIN_PLAYERS_TO_START } from '@/lib/types';
import type { PlayerClientState } from '@/lib/types';

interface LobbyStatusMessageProps {
  players: PlayerClientState[];
  hostPlayerId: string | null;
  thisPlayerId: string | null;
  showStartGameButton: boolean;
}

export default function LobbyStatusMessage({ 
  players, 
  hostPlayerId, 
  thisPlayerId, 
  showStartGameButton 
}: LobbyStatusMessageProps) {
  const enoughPlayers = players.length >= MIN_PLAYERS_TO_START;
  const allPlayersReady = enoughPlayers && players.every(p => p.isReady);

  let lobbyMessage = "";
  if (!enoughPlayers) {
    lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players. Waiting for ${MIN_PLAYERS_TO_START - players.length} more...`;
  } else if (!allPlayersReady) {
    const unreadyCount = players.filter(p => !p.isReady).length;
    lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to ready up.`;
  } else if (!showStartGameButton) {
    const hostPlayer = hostPlayerId ? players.find(p => p.id === hostPlayerId) : null;
    lobbyMessage = `Waiting for ${hostPlayer?.name || 'The host'} to start the game.`;
  }

  return (
    <div className="text-center px-4 pt-4 space-y-2">
      <p className="bg-transparent font-semibold text-black">{lobbyMessage}</p>
      {!enoughPlayers || !allPlayersReady ? (
        <p className="bg-transparent font-semibold text-black">Tap the toggle to ready up</p>
      ) : null}
    </div>
  );
}