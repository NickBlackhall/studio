
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import Scoreboard from './Scoreboard';
import FlippingWinnerCard from './FlippingWinnerCard';
import Image from 'next/image';

interface RecapSequenceDisplayProps {
  recapStep: 'winner' | 'scoreboard' | 'getReady' | null;
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
  defaultOpenScoreboard?: boolean;
}

export default function RecapSequenceDisplay({
  recapStep,
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
}: RecapSequenceDisplayProps) {
  const [isSlidIn, setIsSlidIn] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const isMountedRef = useRef(true);
  
  // Future state for multi-face card:
  // const [rotation, setRotation] = useState(0); 
  // e.g., 0=winner banner, 180=details, 360=scoreboard

  useEffect(() => {
    isMountedRef.current = true;
    const timers: NodeJS.Timeout[] = [];
    
    // Reset state on new recap
    setIsSlidIn(false);
    setIsFlipped(false);
    
    // Start sequence
    timers.push(setTimeout(() => {
      if (isMountedRef.current) setIsSlidIn(true);
    }, 100)); // Short delay to allow component to mount

    // Schedule the first flip
    timers.push(setTimeout(() => {
      if (isMountedRef.current) setIsFlipped(true);
    }, 3000)); // 3 seconds after slide-in starts

    // TODO: Schedule subsequent flips for scoreboard etc. here
    // timers.push(setTimeout(() => {
    //   if (isMountedRef.current) setRotation(360);
    // }, 7000));

    return () => {
      isMountedRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, [recapStep, lastWinnerPlayer]);

  if (!recapStep) return null;

  // The 'winner' step now controls the new flipping card animation
  if (recapStep === 'winner') {
    return (
       <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
        <motion.div
          initial={{ x: '-110vw' }}
          animate={{ x: isSlidIn ? 0 : '-110vw' }}
          transition={{ duration: 0.7, ease: [0.32, 1, 0.45, 1] }}
          className="w-full max-w-sm"
        >
          <FlippingWinnerCard
            isFlipped={isFlipped}
            winner={lastWinnerPlayer}
            cardText={lastWinnerCardText}
          />
        </motion.div>
      </div>
    );
  }

  // Scoreboard and GetReady steps remain for now, but will be integrated into the card flip later
  if (recapStep === 'scoreboard') {
     return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
            <motion.div
                key="scoreboard-step"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="relative w-full max-w-md"
            >
                <Image
                    src="/backgrounds/scoreboard-poster.png"
                    alt="Leaderboard"
                    width={512}
                    height={768}
                    className="object-contain"
                    priority
                    data-ai-hint="scoreboard poster"
                />
                <div className="absolute top-[40%] bottom-[15%] left-[10%] right-[10%]">
                    <Scoreboard
                        players={players}
                        currentJudgeId={currentJudgeId}
                    />
                </div>
            </motion.div>
        </div>
     );
  }

  if (recapStep === 'getReady') {
      return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
            <motion.div
                key="getReady-step"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex flex-col items-center justify-center text-center"
            >
                <h2 className="text-5xl font-bold text-accent mb-8 animate-pulse drop-shadow-lg">
                Get Ready!
                </h2>
                <p className="text-2xl text-muted-foreground">
                The next round is about to begin...
                </p>
                <div className="mt-8 text-primary">
                <svg className="animate-spin h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                </div>
            </motion.div>
        </div>
      );
  }

  return null;
}
