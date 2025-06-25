
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
      <div className="relative w-full max-w-lg mx-auto" style={{ aspectRatio: '2158 / 1431' }}>
        {/* Background Image */}
        <Image
          src="/ui/player-ui-background.png"
          alt="Game UI Frame"
          fill
          priority
          data-ai-hint="game ui frame"
        />

        {/* Dynamic Content Container */}
        <div className="absolute inset-0">
          {/* Player Avatar - positioned in the golden area */}
          <div
            className="absolute"
            style={{
              top: '8.5%',
              left: '5%',
              width: '29.4%',
              aspectRatio: '1'
            }}
          >
            <Avatar className="w-full h-full rounded-lg">
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback className="text-lg font-bold">{playerInitials}</AvatarFallback>
            </Avatar>
          </div>

          {/* Player Name - positioned in the scroll area */}
          <div
            className="absolute flex items-center justify-start"
            style={{
              top: '27%',
              left: '37.5%',
              width: '45%',
              height: '25%'
            }}
          >
            <p
              className="font-im-fell text-black font-bold leading-tight text-left"
              style={{
                fontSize: 'clamp(0.875rem, 4vw, 2.5rem)',
                textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
              }}
            >
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button
            onClick={onScoresClick}
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '63%',
              left: '23%',
              width: '22%',
              aspectRatio: '1'
            }}
          >
            <Image src="/ui/scores-button.png" alt="Scores" fill data-ai-hint="scores button" />
          </button>

          {/* Round Indicator */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '63%',
              left: '46.9%',
              width: '22%',
              aspectRatio: '1'
            }}
          >
            <Image src="/ui/round-button.png" alt="Round" fill data-ai-hint="round indicator" />
            <p
              className="absolute font-corben text-black font-bold drop-shadow-lg"
              style={{
                fontSize: 'clamp(1.25rem, 6vw, 2.5rem)',
                top: '63%',
                left: '50%',
                transform: 'translate(-50%, -40%)'
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
              top: '63%',
              left: '71%',
              width: '22%',
              aspectRatio: '1'
            }}
          >
            <Image src="/ui/menu-button.png" alt="Menu" fill data-ai-hint="menu button"/>
          </button>
        </div>
      </div>
    </div>
  );
}
