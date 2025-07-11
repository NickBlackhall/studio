
"use client";

import { useState, useEffect, useTransition } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import type { GameClientState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GameOverDisplayProps {
  gameState: GameClientState;
  onPlayAgainYes: () => Promise<void>;
  onPlayAgainNo: () => void;
}

const Face = ({ children, isFlipped, className }: { children: React.ReactNode, isFlipped: boolean, className?: string }) => (
  <div
    className={cn(
        "absolute w-full h-full [backface-visibility:hidden] rounded-2xl overflow-hidden",
        className
    )}
    style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
  >
    {children}
  </div>
);

export default function GameOverDisplay({ gameState, onPlayAgainYes, onPlayAgainNo }: GameOverDisplayProps) {
  const [rotation, setRotation] = useState(0);
  const [isYesPending, startYesTransition] = useTransition();
  const [isNoPending, startNoTransition] = useTransition();

  const overallWinner = gameState.winningPlayerId
    ? gameState.players.find(p => p.id === gameState.winningPlayerId)
    : null;

  useEffect(() => {
    if (!overallWinner) return;

    const timer = setTimeout(() => {
      setRotation(180);
    }, 8000); // Flip after 8 seconds

    return () => clearTimeout(timer);
  }, [overallWinner]);

  if (!overallWinner) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-xl">Determining the Grand Champion...</p>
        </div>
    );
  }

  const winnerAvatarPath = overallWinner.avatar.replace('.png', '-winner.png');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg aspect-[1024/1536]" style={{ perspective: '2000px' }}>
            <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: rotation }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
            >
                {/* Face 1: The Champion */}
                <Face isFlipped={false}>
                    <Image
                        src="/backgrounds/game-winner-poster.png"
                        alt="Game Winner"
                        fill
                        className="object-cover"
                        priority
                        data-ai-hint="game winner poster"
                    />
                    <div className="absolute inset-0">
                        {/* Winner Avatar */}
                        <div className="absolute top-[32%] left-1/2 -translate-x-1/2 w-[41%]">
                            <Image
                                src={winnerAvatarPath}
                                alt={`Winner: ${overallWinner.name}`}
                                width={698}
                                height={698}
                                className="w-full h-auto object-contain"
                                priority
                                data-ai-hint="winner avatar"
                            />
                        </div>
                        {/* Winner Name */}
                        <div className="absolute top-[79%] left-1/2 -translate-x-1/2 w-[80%] text-center">
                            <p
                                className="font-im-fell text-black font-bold drop-shadow-lg"
                                style={{ fontSize: 'clamp(2rem, 10vw, 3rem)' }}
                            >
                                {overallWinner.name}
                            </p>
                        </div>
                    </div>
                </Face>

                {/* Face 2: Play Again? */}
                <Face isFlipped={true}>
                    <Image
                        src="/backgrounds/play-again-poster.png"
                        alt="Play Again?"
                        fill
                        className="object-cover"
                        priority
                        data-ai-hint="play again poster"
                    />
                    <div className="absolute inset-0">
                        <button
                            onClick={() => startNoTransition(onPlayAgainNo)}
                            disabled={isYesPending || isNoPending}
                            className="absolute cursor-pointer border-2 border-red-500"
                            style={{
                                top: '41%',
                                left: '10.5%',
                                width: '38%',
                                height: '16.5%',
                            }}
                            aria-label="No, I'm done"
                        />
                        <button
                            onClick={() => startYesTransition(onPlayAgainYes)}
                            disabled={isYesPending || isNoPending}
                            className="absolute cursor-pointer border-2 border-red-500"
                            style={{
                                top: '41%',
                                right: '10.5%',
                                width: '38%',
                                height: '16.5%',
                            }}
                            aria-label="Yes, play again"
                        />
                    </div>
                </Face>
            </motion.div>
        </div>
    </div>
  );
}
