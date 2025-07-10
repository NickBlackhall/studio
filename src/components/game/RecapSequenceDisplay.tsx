
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
    winnerBanner: 3000, // Increased from 2000
    winnerDetails: 4000,
    scoreboard: 4000,
    loading: 5000, // Increased from 3000
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

  // Effect to kick off the sequence. Re-runs if the winner changes.
  useEffect(() => {
    // Reset state for the new round winner
    setHasStartedNextRound(false);
    setRotation(0);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Sequence starts here
    // 1. Show banner, then flip to details
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setRotation(180);
      }
    }, RECAP_STEP_DURATIONS.winnerBanner);

    // 2. Show details, then flip to scoreboard
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setRotation(360);
      }
    }, RECAP_STEP_DURATIONS.winnerBanner + RECAP_STEP_DURATIONS.winnerDetails);

    // 3. Show scoreboard, then flip to loading
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setRotation(540);
      }
    }, RECAP_STEP_DURATIONS.winnerBanner + RECAP_STEP_DURATIONS.winnerDetails + RECAP_STEP_DURATIONS.scoreboard);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastWinnerPlayer.id, lastWinnerCardText]); // Re-trigger if winner changes

  // Effect to trigger next round once the loading animation is visible
  useEffect(() => {
    if (rotation === 540 && thisPlayerIsJudge && !hasStartedNextRound) {
      setHasStartedNextRound(true);
      // Add a small delay to ensure the loading screen is visible before the state changes
      setTimeout(() => {
        if (isMountedRef.current) {
          onNextRound();
        }
      }, RECAP_STEP_DURATIONS.loading); // Use the loading duration here
    }
  }, [rotation, thisPlayerIsJudge, hasStartedNextRound, onNextRound]);
  
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
