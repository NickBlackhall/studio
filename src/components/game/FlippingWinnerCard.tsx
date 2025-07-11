
"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { PlayerClientState } from '@/lib/types';
import { memo } from 'react';
import Scoreboard from './Scoreboard';
import AvatarLoadingSequence from './AvatarLoadingSequence';

interface FlippingWinnerCardProps {
  rotation: number;
  winner: PlayerClientState;
  cardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
}

const Face = ({ children, rotationY = 0 }: { children: React.ReactNode, rotationY?: number }) => (
  <div
    className="absolute w-full h-full [backface-visibility:hidden] rounded-2xl overflow-hidden bg-black"
    style={{ transform: `rotateY(${rotationY}deg)` }}
  >
    {children}
  </div>
);

function FlippingWinnerCard({ rotation, winner, cardText, players, currentJudgeId }: FlippingWinnerCardProps) {
  return (
    <div className="w-full aspect-[1024/1536]" style={{ perspective: '2000px' }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: rotation }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      >
        {/* Face 1: Round Winner Banner (0 degrees) */}
        <Face rotationY={0}>
          <Image
            src="/backgrounds/round-winner-poster.png"
            alt="Round Winner"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            data-ai-hint="winner banner"
          />
        </Face>
        
        {/* Face 2: Winner Details (180 degrees) */}
        <Face rotationY={180}>
          <Image
            src="/backgrounds/winner-details-poster.png"
            alt="Winner Details"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            data-ai-hint="winner details poster"
          />
          <div className="absolute inset-0">
            {/* Avatar positioned within its area */}
            <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-[48%]">
              <Avatar className="w-full h-auto aspect-square rounded-md">
                <AvatarImage src={winner.avatar} alt={winner.name} />
                <AvatarFallback>{winner.name?.substring(0, 2).toUpperCase() || 'P'}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Player Name positioned within its area */}
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 w-[80%] text-center">
              <p 
                className="font-im-fell text-black font-bold leading-none drop-shadow"
                style={{ fontSize: 'clamp(1.5rem, 8vw, 2.5rem)' }}
              >
                {winner.name}
              </p>
            </div>
            
            {/* Response Card positioned at the bottom */}
            <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[88%] aspect-[1536/600]">
              <Image
                src="/ui/mit-card-front.png"
                alt="Winning response card"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 80vw, 30vw"
                data-ai-hint="card front"
              />
              <div className="absolute inset-0 flex items-center justify-center p-[8%]">
                <p 
                  className="font-im-fell text-black text-center leading-tight"
                  style={{ fontSize: 'clamp(0.75rem, 3.5vw, 1.25rem)' }}
                >
                  {cardText}
                </p>
              </div>
            </div>
          </div>
        </Face>
        
        {/* Face 3: Scoreboard (360 degrees) */}
        <Face rotationY={360}>
          <div className="relative w-full h-full">
            <Image
              src="/backgrounds/scoreboard-poster.png"
              alt="Leaderboard"
              fill
              className="object-cover"
              priority
              data-ai-hint="scoreboard poster"
            />
            <div className="absolute left-[10%] right-[10%] bottom-[15%]" style={{ top: '45%' }}>
              <Scoreboard
                players={players}
                currentJudgeId={currentJudgeId}
              />
            </div>
          </div>
        </Face>
        
        {/* Face 4: Get Ready / Loading (540 degrees) */}
        <Face rotationY={540}>
          <Image
            src="/backgrounds/get-ready-poster.png"
            alt="Get Ready for the next round"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            data-ai-hint="get ready poster"
          />
          <div className="absolute inset-0 flex flex-col items-center" style={{ top: '55%', transform: 'translateY(-50%)' }}>
              <AvatarLoadingSequence 
                  players={players} 
                  message={<>The next round will<br />start soon!</>}
              />
          </div>
        </Face>
      </motion.div>
    </div>
  );
}

export default memo(FlippingWinnerCard);
