
"use client";

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import FlippingWinnerCard from './FlippingWinnerCard';
import Image from 'next/image';

interface RecapSequenceDisplayProps {
  recapStep: 'winner' | 'scoreboard' | null;
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
}

function RecapSequenceDisplay({
  recapStep,
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
}: RecapSequenceDisplayProps) {
  const [rotation, setRotation] = useState(0);
  const isMountedRef = useRef(true);

  // This effect now only responds to the recapStep changing, preventing mid-animation stutters
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
      setRotation(180);
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(360);
      }, 100); 
    }

    return () => {
      isMountedRef.current = false;
      if(timer) clearTimeout(timer);
    };
  }, [recapStep]);

  if (!recapStep) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
      <motion.div
        key="winner-card"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
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
    </div>
  );
}

export default memo(RecapSequenceDisplay);
