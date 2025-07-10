
"use client";

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import FlippingWinnerCard from './FlippingWinnerCard';
import Image from 'next/image';

interface RecapSequenceDisplayProps {
  recapStep: 'winner' | 'scoreboard' | 'loading' | null;
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
  thisPlayerIsJudge: boolean;
  onNextRound: () => void;
}

function RecapSequenceDisplay({
  recapStep,
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
  thisPlayerIsJudge,
  onNextRound,
}: RecapSequenceDisplayProps) {
  const [rotation, setRotation] = useState(0);
  const isMountedRef = useRef(true);
  const [hasStartedNextRound, setHasStartedNextRound] = useState(false);

  // This effect now only responds to the recapStep changing, preventing mid-animation stutters
  useEffect(() => {
    isMountedRef.current = true;
    let timer: NodeJS.Timeout;

    if (recapStep === 'winner') {
      setRotation(0);
      // Schedule the first flip to winner details
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(180);
      }, 2000); // 2 seconds to view winner banner
    } else if (recapStep === 'scoreboard') {
      setRotation(180);
      // Schedule the second flip to the scoreboard
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(360);
      }, 100); 
    } else if (recapStep === 'loading') {
      setRotation(360);
      // Schedule the final flip to the loading poster
      timer = setTimeout(() => {
        if (isMountedRef.current) setRotation(540);
      }, 100);
      
      // The judge is responsible for kicking off the next round for everyone.
      if (thisPlayerIsJudge && !hasStartedNextRound) {
        setHasStartedNextRound(true);
        onNextRound();
      }
    }

    return () => {
      isMountedRef.current = false;
      if(timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapStep]);
  
  useEffect(() => {
    if (recapStep !== 'loading') {
        setHasStartedNextRound(false);
    }
  }, [recapStep]);

  if (!recapStep) return null;
  
  return (
    <motion.div 
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <AnimatePresence>
        <motion.div
          key="winner-card-sequence"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
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
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(RecapSequenceDisplay);
