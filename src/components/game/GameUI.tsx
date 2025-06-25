"use client";

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// We'll pass real data in later. For now, it's all static placeholders.
interface GameUIProps {
  // Props will be added here in future steps
}

export default function GameUI({}: GameUIProps) {
  const roundNumber = 3;
  const playerName = "Terrible Terry";
  const playerAvatar = "/ui/avatar5.png"; // Placeholder avatar

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
              top: '11%',
              left: '8.5%',
              width: '24%',
              aspectRatio: '1'
            }}
          >
            <Avatar className="w-full h-full border-[2px] border-black rounded-lg shadow-lg">
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback className="text-lg font-bold">TT</AvatarFallback>
            </Avatar>
          </div>

          {/* Player Name - positioned in the scroll area */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '12%',
              left: '25%',
              width: '45%',
              height: '25%'
            }}
          >
            <p
              className="font-im-fell text-black font-bold leading-tight text-center"
              style={{
                fontSize: 'clamp(0.875rem, 4vw, 1.5rem)',
                textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
              }}
            >
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '50%',
              left: '47%',
              width: '16%',
              aspectRatio: '1'
            }}
          >
            <Image src="/ui/scores-button.png" alt="Scores" fill data-ai-hint="scores button" />
          </button>

          {/* Round Indicator */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '50%',
              left: '65%',
              width: '16%',
              aspectRatio: '1'
            }}
          >
            <Image src="/ui/round-button.png" alt="Round" fill data-ai-hint="round indicator" />
            <p
              className="absolute font-corben text-white font-bold drop-shadow-lg"
              style={{
                fontSize: 'clamp(1.25rem, 6vw, 2.5rem)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -40%)'
              }}
            >
              {roundNumber}
            </p>
          </div>

          {/* Menu Button */}
          <button
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '50%',
              left: '83%',
              width: '14%',
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
