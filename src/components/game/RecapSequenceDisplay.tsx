
"use client";

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import FlippingWinnerCard from './FlippingWinnerCard';
import Image from 'next/image';

interface RecapSequenceDisplayProps {
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
  thisPlayerIsJudge: boolean;
  onNextRound: () => void;
}

const RECAP_STEP_DURATIONS = {
    winnerBanner: 2000,
    winnerDetails: 4000,
    scoreboard: 4000,
    loading: 3000,
};

function RecapSequenceDisplay({
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
  thisPlayerIsJudge,
  onNextRound,
}: RecapSequenceDisplayProps) {
  const [rotation, setRotation] = useState(0);
  const [internalStep, setInternalStep] = useState<'winner' | 'scoreboard' | 'loading' | null>(null);
  const [hasStartedNextRound, setHasStartedNextRound] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Cleanup function to clear timers on unmount
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Effect to start and manage the animation sequence
  useEffect(() => {
    // Clear any existing timers when the effect re-runs
    if (timerRef.current) clearTimeout(timerRef.current);

    if (internalStep === 'winner') {
      setRotation(0);
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setRotation(180); // Flip to details
      }, RECAP_STEP_DURATIONS.winnerBanner);
      
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setInternalStep('scoreboard');
      }, RECAP_STEP_DURATIONS.winnerBanner + RECAP_STEP_DURATIONS.winnerDetails);
    
    } else if (internalStep === 'scoreboard') {
      if (rotation !== 180) setRotation(180);
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setRotation(360); // Flip to scoreboard
      }, 100);
      
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setInternalStep('loading');
      }, RECAP_STEP_DURATIONS.scoreboard);

    } else if (internalStep === 'loading') {
      if (rotation !== 360) setRotation(360);
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setRotation(540); // Flip to loading
      }, 100);

      // The judge is responsible for kicking off the next round for everyone.
      if (thisPlayerIsJudge && !hasStartedNextRound) {
        setHasStartedNextRound(true);
        // Add a small delay to ensure the loading screen is visible before the state changes
        setTimeout(() => {
          onNextRound();
        }, 500);
      }
    }
  }, [internalStep, thisPlayerIsJudge, hasStartedNextRound, onNextRound, rotation]);

  // Effect to kick off the sequence
  useEffect(() => {
    setHasStartedNextRound(false);
    setInternalStep('winner');
  }, [lastWinnerPlayer.id, lastWinnerCardText]); // Re-trigger if winner changes
  
  if (!internalStep) return null;
  
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
