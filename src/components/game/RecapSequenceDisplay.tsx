
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import FlippingWinnerCard from './FlippingWinnerCard';
import Image from 'next/image';

interface RecapSequenceDisplayProps {
  recapStep: 'winner' | 'scoreboard' | 'getReady' | null;
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
}

export default function RecapSequenceDisplay({
  recapStep,
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
}: RecapSequenceDisplayProps) {
  const [rotation, setRotation] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let timer: NodeJS.Timeout;

    if (recapStep === 'winner') {
      setRotation(0);
      // Schedule the first flip to winner details
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(180);
      }, 3000);
    } else if (recapStep === 'scoreboard') {
      // Schedule the second flip to the scoreboard
      // We start from 180 to ensure a continuous spin from the previous state
      setRotation(180);
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(360);
      }, 100); // short delay to start animation
    }

    return () => {
      isMountedRef.current = false;
      if(timer) clearTimeout(timer);
    };
  }, [recapStep]);

  if (!recapStep) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
      <AnimatePresence>
        {recapStep === 'getReady' ? (
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
        ) : (
          <motion.div
            key="winner-card"
            initial={{ x: '-110vw' }}
            animate={{ x: 0 }}
            exit={{ x: '110vw' }}
            transition={{ duration: 0.7, ease: [0.32, 1, 0.45, 1] }}
            className="w-full max-w-sm"
          >
            <FlippingWinnerCard
              rotation={rotation}
              winner={lastWinnerPlayer}
              cardText={lastWinnerCardText}
              players={players}
              currentJudgeId={currentJudgeId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
