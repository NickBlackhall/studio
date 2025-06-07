
"use client";

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerClientState } from '@/lib/types';
import Scoreboard from './Scoreboard'; // Assuming Scoreboard can be used here
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // For styling consistency

interface RecapSequenceDisplayProps {
  recapStep: 'winner' | 'scoreboard' | 'getReady' | null;
  lastWinnerPlayer: PlayerClientState;
  lastWinnerCardText: string;
  players: PlayerClientState[];
  currentJudgeId: string | null;
  // nextJudgeName?: string; // Optional: if we can pass this
}

const stepVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeInOut" } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeInOut" } },
};

export default function RecapSequenceDisplay({
  recapStep,
  lastWinnerPlayer,
  lastWinnerCardText,
  players,
  currentJudgeId,
}: RecapSequenceDisplayProps) {
  if (!recapStep) return null;

  const renderAvatar = (avatarPath: string | null | undefined, playerName: string) => {
    if (avatarPath && avatarPath.startsWith('/')) {
      return (
        <Image
          src={avatarPath}
          alt={`${playerName}'s avatar`}
          width={80}
          height={80}
          className="rounded-lg object-contain border-4 border-black shadow-lg"
          data-ai-hint="player avatar"
          priority // Prioritize avatar loading
        />
      );
    }
    return <span className="text-6xl p-2 border-4 border-black rounded-lg shadow-lg bg-white/20">{avatarPath || '🤔'}</span>;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-hidden">
      <AnimatePresence mode="wait">
        {recapStep === 'winner' && (
          <motion.div
            key="winner-step"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center text-center w-full max-w-lg"
          >
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mb-6">
              <Image
                src="/round-winner-banner.png"
                alt="Round Winner!"
                width={500}
                height={188} 
                className="object-contain"
                data-ai-hint="winner banner"
                priority // Prioritize banner loading
              />
            </div>
            <div className="flex flex-col items-center space-y-3 mb-6">
              {renderAvatar(lastWinnerPlayer.avatar, lastWinnerPlayer.name)}
              <p className="text-4xl md:text-5xl font-extrabold text-primary drop-shadow-md">
                {lastWinnerPlayer.name}
              </p>
            </div>
            <Card className="w-full bg-card/80 border-2 border-secondary shadow-xl">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg text-secondary font-semibold">Played:</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-xl md:text-2xl font-medium leading-tight text-card-foreground">
                  &ldquo;{lastWinnerCardText}&rdquo;
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {recapStep === 'scoreboard' && (
          <motion.div
            key="scoreboard-step"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center text-center w-full max-w-md"
          >
            <h2 className="text-4xl font-bold text-primary mb-6 drop-shadow-sm">Scores Updated!</h2>
            <div className="w-full">
              <Scoreboard players={players} currentJudgeId={currentJudgeId} />
            </div>
          </motion.div>
        )}

        {recapStep === 'getReady' && (
          <motion.div
            key="getReady-step"
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center text-center"
          >
            <h2 className="text-5xl font-bold text-accent mb-8 animate-pulse drop-shadow-lg">
              Get Ready!
            </h2>
            <p className="text-2xl text-muted-foreground">
              The next round is about to begin...
            </p>
            {/* Optional: Next judge info
            {nextJudgeName && (
              <p className="text-lg text-muted-foreground mt-2">
                Next Judge: {nextJudgeName}
              </p>
            )} */}
            <div className="mt-8 text-primary">
              <svg className="animate-spin h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
