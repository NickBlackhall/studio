
"use client";

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { GameClientState, PlayerClientState } from '@/lib/types';

interface GameUIProps {
  gameState: GameClientState | null;
  thisPlayer: PlayerClientState | null;
  onScoresClick: () => void;
  onMenuClick: () => void;
}

export default function GameUI({ gameState, thisPlayer, onScoresClick, onMenuClick }: GameUIProps) {
  if (!gameState || !thisPlayer) {
    return null;
  }

  const roundNumber = gameState.currentRound;
  const playerName = thisPlayer.name;
  const playerAvatar = thisPlayer.avatar;
  const playerInitials = playerName?.substring(0, 2).toUpperCase() || '??';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      {/* This div centers the UI and sets its max width and aspect ratio */}
      <div className="relative w-full max-w-lg mx-auto" style={{ aspectRatio: '1986 / 858' }}>
        {/* Background Image */}
        <Image
          src="/ui/MIT-player-ui-v2.png"
          alt="Game UI Frame"
          fill
          priority
          data-ai-hint="game ui frame"
        />

        {/* Dynamic Content Container */}
        <div className="absolute inset-0">
          {/* Player Avatar */}
          <div
            className="absolute"
            style={{
              top: '15%',
              left: '3.5%',
              width: '15%',
              aspectRatio: '1'
            }}
          >
            <Avatar className="w-full h-full rounded-lg border-2 border-black/50">
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback className="text-lg font-bold">{playerInitials}</AvatarFallback>
            </Avatar>
          </div>

          {/* Player Name */}
          <div
            className="absolute flex items-center justify-start"
            style={{
              top: '30%',
              left: '21%',
              width: '35%',
              height: '40%'
            }}
          >
            <p
              className="font-im-fell text-black font-bold leading-tight text-left"
              style={{
                fontSize: 'clamp(1rem, 4vw, 1.75rem)',
                textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
              }}
            >
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button
            onClick={onScoresClick}
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
            style={{
              top: '15%',
              left: '59%',
              width: '12%',
              aspectRatio: '1'
            }}
            aria-label="View Scores"
          >
            <Image
              src="/ui/scores-button-v2.png"
              alt="Scores"
              width={625}
              height={204}
              className="object-contain w-[80%] h-auto"
              data-ai-hint="scores button"
            />
          </button>

          {/* Round Indicator */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '15%',
              left: '72%',
              width: '12%',
              aspectRatio: '1'
            }}
          >
            <p
              className="absolute font-corben text-black font-bold drop-shadow-lg"
              style={{
                fontSize: 'clamp(1.25rem, 5vw, 2rem)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              {roundNumber}
            </p>
          </div>

          {/* Menu Button */}
          <button
            onClick={onMenuClick}
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '15%',
              left: '85%',
              width: '12%',
              aspectRatio: '1'
            }}
            aria-label="Open Menu"
          >
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
