"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useSharedGame } from '@/contexts/SharedGameContext';
import { useLoading } from '@/contexts/LoadingContext';
import type { TransitionState } from '@/lib/types';

interface UnifiedTransitionOverlayProps {
  forceShow?: boolean;
  forceMessage?: string;
}

export default function UnifiedTransitionOverlay({ 
  forceShow = false, 
  forceMessage 
}: UnifiedTransitionOverlayProps) {
  const { gameState, isInitializing } = useSharedGame();
  const { isGlobalLoading } = useLoading();

  // Determine if we should show the overlay
  const shouldShow = forceShow || 
                     isInitializing || 
                     isGlobalLoading ||
                     (gameState?.transitionState && gameState.transitionState !== 'idle');

  // Determine the message to show
  let message = forceMessage;
  if (!message) {
    if (isInitializing) {
      message = "Initializing game...";
    } else if (gameState?.transitionMessage) {
      message = gameState.transitionMessage;
    } else if (gameState?.transitionState && gameState.transitionState !== 'idle') {
      message = getTransitionMessage(gameState.transitionState);
    } else if (isGlobalLoading) {
      // Better message for navigation loading
      message = gameState?.gamePhase === 'lobby' ? "Starting game..." : "Loading...";
    }
  }

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999]"
          data-testid="transition-overlay"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.16, 1, 0.3, 1], // Custom cubic-bezier for smooth motion
              scale: { duration: 0.3 },
              opacity: { duration: 0.4 }
            }}
            className="bg-white p-8 rounded-2xl text-center shadow-2xl flex flex-col items-center gap-4 text-black max-w-sm mx-4 border border-gray-200/20"
            data-testid="transition-content"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-primary" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="font-semibold text-xl"
              data-testid="transition-message"
            >
              {message || "Loading..."}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getTransitionMessage(transitionState: TransitionState): string {
  switch (transitionState) {
    case 'starting_game':
      return 'Starting game...';
    case 'dealing_cards':
      return 'Dealing cards...';
    case 'selecting_scenario':
      return 'Selecting scenario...';
    case 'processing_submissions':
      return 'Processing submissions...';
    case 'announcing_winner':
      return 'Announcing winner...';
    case 'next_round':
      return 'Preparing next round...';
    case 'game_ending':
      return 'Ending game...';
    case 'resetting_game':
      return 'Resetting game... You will be redirected to the main menu.';
    default:
      return 'Loading...';
  }
}