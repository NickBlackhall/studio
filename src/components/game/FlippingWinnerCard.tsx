
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
      // Face 2 should not be on the front. This logic is handled by the flip.
      // We will render Face 3 content here when its time comes.
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
      // Face 3 should be visible on the front
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
      // Face 4 should not be on the front. This logic is handled by the flip.
      // After 540, the front can show the "Round winner" again if looping
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
      // Face 3 should not be on the back.
      // This is the period where the Winner Details (face 2) are showing.
      // The back should be preparing Face 4.
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
    } else if (rotation >= 360 && rotation < 540) {
      // Face 4 should be visible on the back
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
      // After 540, back can show Face 2 again for looping
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
    }
  };

  const correctedGetFrontContent = () => {
    if (rotation >= 0 && rotation < 180) return getFaceContent(1); // Winner Banner
    if (rotation >= 180 && rotation < 360) return getFaceContent(2); // Winner Details
    if (rotation >= 360 && rotation < 540) return getFaceContent(3); // Scoreboard
    return getFaceContent(4); // Get Ready
  };

  const getFaceContent = (faceNumber: number) => {
    switch (faceNumber) {
      case 1:
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
      case 2:
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
      case 3:
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
      case 4:
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
      default:
        return null;
    }
  };

  // Determine what content should be on the front and back of the two physical faces
  const frontCardContent = Math.floor(rotation / 180) % 2 === 0 ? getFaceContent(Math.floor(rotation / 180) + 1) : getFaceContent(Math.floor(rotation / 180) + 2);
  const backCardContent = Math.floor(rotation / 180) % 2 === 0 ? getFaceContent(Math.floor(rotation / 180) + 2) : getFaceContent(Math.floor(rotation / 180) + 1);


  return (
    <div className="w-full aspect-[1024/1536]" style={{ perspective: '2000px' }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: rotation }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      >
        <Face isBack={false}>
          {frontCardContent}
        </Face>
        <Face isBack={true}>
          {backCardContent}
        </Face>
      </motion.div>
    </div>
  );
}

export default memo(FlippingWinnerCard);
