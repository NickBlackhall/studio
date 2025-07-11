"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { PlayerClientState } from '@/lib/types';
import { memo } from 'react';
import Scoreboard from './Scoreboard';
import AvatarLoadingSequence from './AvatarLoadingSequence';

// Two physical faces: front (0°) and back (180°)
const Face = ({ children, isBack = false }: { children: React.ReactNode, isBack?: boolean }) => (
  <div
    className="absolute w-full h-full [backface-visibility:hidden] rounded-2xl overflow-hidden bg-black"
    style={{ 
      transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
    }}
  >
    {children}
  </div>
);

interface FlippingWinnerCardProps {
  rotation: number;
  winner: PlayerClientState;
  cardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
}

function FlippingWinnerCard({ rotation, winner, cardText, players, currentJudgeId }: FlippingWinnerCardProps) {
  
  // Determine which face should be on front and back based on current rotation
  const getFrontContent = () => {
    if (rotation >= 0 && rotation < 180) {
      // Face 1 should be visible
      return (
        <Image
          src="/backgrounds/round-winner-poster.png"
          alt="Round Winner"
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          data-ai-hint="winner banner"
        />
      );
    } else if (rotation >= 180 && rotation < 360) {
      // Face 2 should be visible  
      return (
        <>
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
            <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-[48%]">
              <Avatar className="w-full h-auto aspect-square rounded-md">
                <AvatarImage src={winner.avatar} alt={winner.name} />
                <AvatarFallback>{winner.name?.substring(0, 2).toUpperCase() || 'P'}</AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 w-[80%] text-center">
              <p 
                className="font-im-fell text-black font-bold leading-none drop-shadow"
                style={{ fontSize: 'clamp(1.5rem, 8vw, 2.5rem)' }}
              >
                {winner.name}
              </p>
            </div>
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
        </>
      );
    } else if (rotation >= 360 && rotation < 540) {
      // Face 3 should be visible
      return (
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
      );
    } else {
      // Face 4 should be visible (540°+)
      return (
        <>
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
        </>
      );
    }
  };

  const getBackContent = () => {
    if (rotation >= 0 && rotation < 180) {
      // Face 2 should be ready on back
      return (
        <>
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
            <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-[48%]">
              <Avatar className="w-full h-auto aspect-square rounded-md">
                <AvatarImage src={winner.avatar} alt={winner.name} />
                <AvatarFallback>{winner.name?.substring(0, 2).toUpperCase() || 'P'}</AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 w-[80%] text-center">
              <p 
                className="font-im-fell text-black font-bold leading-none drop-shadow"
                style={{ fontSize: 'clamp(1.5rem, 8vw, 2.5rem)' }}
              >
                {winner.name}
              </p>
            </div>
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
        </>
      );
    } else if (rotation >= 180 && rotation < 360) {
      // Face 3 should be ready on back
      return (
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
      );
    } else if (rotation >= 360 && rotation < 540) {
      // Face 4 should be ready on back
      return (
        <>
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
        </>
      );
    } else {
      // Could prepare Face 1 again for looping, or leave empty
      return (
        <Image
          src="/backgrounds/round-winner-poster.png"
          alt="Round Winner"
          fill
          className="object-cover"
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          data-ai-hint="winner banner"
        />
      );
    }
  };

  return (
    <div className="w-full aspect-[1024/1536]" style={{ perspective: '2000px' }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: rotation }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      >
        {/* Front Face - Shows Face 1 and Face 3 */}
        <Face isBack={false}>
          {getFrontContent()}
        </Face>
        
        {/* Back Face - Shows Face 2 and Face 4 */}
        <Face isBack={true}>
          {getBackContent()}
        </Face>
      </motion.div>
    </div>
  );
}

export default memo(FlippingWinnerCard);