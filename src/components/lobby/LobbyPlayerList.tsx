"use client";

import React from 'react';
import Image from 'next/image';
import { CheckSquare, XSquare } from 'lucide-react';
import ReadyToggle from '@/components/game/ReadyToggle';
import type { PlayerClientState } from '@/lib/types';

interface LobbyPlayerListProps {
  players: PlayerClientState[];
  thisPlayer: PlayerClientState | null;
  onToggleReady: (player: PlayerClientState) => void;
  isProcessingAction: boolean;
}

const PlayerRow = React.memo(function PlayerRow({ 
  player, 
  thisPlayer, 
  onToggleReady, 
  isProcessingAction 
}: { 
  player: PlayerClientState;
  thisPlayer: PlayerClientState | null;
  onToggleReady: (player: PlayerClientState) => void;
  isProcessingAction: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center min-w-0">
        {player.avatar?.startsWith('/') ? (
          <Image 
            src={player.avatar} 
            alt={`${player.name || "Player"}'s avatar`} 
            width={56} 
            height={56} 
            className="mr-3 rounded-sm object-cover flex-shrink-0" 
            data-ai-hint="player avatar" 
            loading="lazy" 
          />
        ) : (
          <span className="text-5xl mr-3 flex-shrink-0">{player.avatar}</span>
        )}
        <h2 className="text-3xl text-black truncate">{player.name || 'Player'}</h2>
      </div>
      <div className="flex-shrink-0 ml-2 flex items-center justify-center">
        {player.id === thisPlayer?.id ? (
          <ReadyToggle 
            isReady={player.isReady} 
            onToggle={() => onToggleReady(player)} 
            disabled={isProcessingAction} 
          />
        ) : (
          player.isReady ? 
            <CheckSquare className="h-12 w-20 text-green-700" /> : 
            <XSquare className="h-12 w-20 text-red-700" />
        )}
      </div>
    </div>
  );
});

PlayerRow.displayName = 'PlayerRow';

export default function LobbyPlayerList({ 
  players, 
  thisPlayer, 
  onToggleReady, 
  isProcessingAction 
}: LobbyPlayerListProps) {
  return (
    <div className="overflow-y-auto space-y-2">
      {players.map((player) => (
        <PlayerRow 
          key={player.id} 
          player={player} 
          thisPlayer={thisPlayer}
          onToggleReady={onToggleReady}
          isProcessingAction={isProcessingAction}
        />
      ))}
    </div>
  );
}