
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
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none w-full h-auto">
      <div className="relative w-full max-w-lg mx-auto aspect-[390/190]">
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
          <div className="absolute top-[16%] left-[6.5%] w-[38%] h-[55%] flex items-center">
            <Avatar className="h-[75%] w-auto aspect-square border-4 border-black rounded-md shadow-lg">
              <AvatarImage src={playerAvatar} alt={playerName} />
              <AvatarFallback>TT</AvatarFallback>
            </Avatar>
            <p className="font-im-fell text-3xl text-black ml-3 leading-tight drop-shadow-sm truncate">
              {playerName}
            </p>
          </div>

          {/* Scores Button */}
          <button className="absolute top-[48%] left-[49.5%] w-[16%] aspect-[63/68] pointer-events-auto transition-transform hover:scale-105 active:scale-95">
            <Image src="/ui/scores-button.png" alt="Scores" fill data-ai-hint="scores button" />
          </button>

          {/* Round Indicator */}
          <div className="absolute top-[48%] left-[68%] w-[16%] aspect-[63/68] flex items-center justify-center">
            <Image src="/ui/round-button.png" alt="Round" fill data-ai-hint="round indicator" />
            <p className="relative font-corben text-5xl text-white drop-shadow-md mt-1">
              {roundNumber}
            </p>
          </div>

          {/* Menu Button */}
          <button className="absolute top-[48%] left-[85.5%] w-[12%] aspect-[47/68] pointer-events-auto transition-transform hover:scale-105 active:scale-95">
            <Image src="/ui/menu-button.png" alt="Menu" fill data-ai-hint="menu button"/>
          </button>
        </div>
      </div>
    </div>
  );
}
