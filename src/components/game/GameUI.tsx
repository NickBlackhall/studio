
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
      <div className="relative w-full max-w-lg mx-auto aspect-[2158/1431]">
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
          <div className="absolute top-[15%] left-[5%] w-[40%] h-[60%] flex items-center p-2">
            <Avatar className="h-full w-auto aspect-square border-[3px] border-black rounded-md shadow-lg">
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback>TT</AvatarFallback>
            </Avatar>
            <p className="font-im-fell text-3xl text-black ml-3 leading-tight drop-shadow-sm truncate">
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button className="absolute top-[49%] left-[48%] w-[18%] aspect-[63/68] pointer-events-auto transition-transform hover:scale-105 active:scale-95">
            <Image src="/ui/scores-button.png" alt="Scores" fill data-ai-hint="scores button" />
          </button>

          {/* Round Indicator */}
          <div className="absolute top-[49%] left-[67%] w-[18%] aspect-[63/68] flex items-center justify-center">
            <Image src="/ui/round-button.png" alt="Round" fill data-ai-hint="round indicator" />
            <p className="relative font-corben text-5xl text-white drop-shadow-md mt-1">
              {roundNumber}
            </p>
          </div>

          {/* Menu Button */}
          <button className="absolute top-[49%] left-[85%] w-[13%] aspect-[47/68] pointer-events-auto transition-transform hover:scale-105 active:scale-95">
            <Image src="/ui/menu-button.png" alt="Menu" fill data-ai-hint="menu button"/>
          </button>
        </div>
      </div>
    </div>
  );
}
