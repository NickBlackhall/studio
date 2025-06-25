
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
          {/* Player Info Section */}
          <div 
            className="absolute flex items-center"
            style={{
              top: '13.3%',
              left: '5.1%',
              width: '44%',
              height: '33.5%',
            }}
          >
            <Avatar 
              className="aspect-square border-[3px] border-black rounded-md shadow-lg"
              style={{ height: '52%' }}
            >
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback>TT</AvatarFallback>
            </Avatar>
            <p 
              className="font-im-fell text-black leading-tight drop-shadow-sm truncate"
              style={{
                fontSize: 'clamp(1rem, 5.5vw, 1.875rem)', // Responsive font size
                marginLeft: '3%',
              }}
            >
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button 
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '48.9%',
              left: '47.7%',
              width: '17.8%',
              aspectRatio: '63 / 68'
            }}
          >
            <Image src="/ui/scores-button.png" alt="Scores" fill data-ai-hint="scores button" />
          </button>

          {/* Round Indicator */}
          <div 
            className="absolute flex items-center justify-center"
            style={{
              top: '48.9%',
              left: '66.7%',
              width: '17.8%',
              aspectRatio: '63 / 68'
            }}
          >
            <Image src="/ui/round-button.png" alt="Round" fill data-ai-hint="round indicator" />
            <p 
              className="relative font-corben text-white drop-shadow-md"
              style={{
                fontSize: 'clamp(1.5rem, 9vw, 3rem)', // Responsive font size
                marginTop: '5%' // Fine-tune vertical position
              }}
            >
              {roundNumber}
            </p>
          </div>

          {/* Menu Button */}
          <button 
            className="absolute pointer-events-auto transition-transform hover:scale-105 active:scale-95"
            style={{
              top: '48.9%',
              left: '85.5%',
              width: '13%',
              aspectRatio: '47 / 68'
            }}
          >
            <Image src="/ui/menu-button.png" alt="Menu" fill data-ai-hint="menu button"/>
          </button>
        </div>
      </div>
    </div>
  );
}
