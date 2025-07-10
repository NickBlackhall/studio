
"use client";

import { useState, useEffect } from 'react';
import type { PlayerClientState } from '@/lib/types';
import styles from '@/components/layout/AvatarLoadingOverlay.module.css';
import Image from 'next/image';

interface AvatarLoadingSequenceProps {
  players: PlayerClientState[];
  message: string;
}

export default function AvatarLoadingSequence({ players, message }: AvatarLoadingSequenceProps) {
  const [animationKey, setAnimationKey] = useState(0);

  const logoPath = "/ui/new-logo.png";
  
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [players]);

  if (players.length === 0) {
    return (
      <div className={styles.fallbackSpinner}>
        <div className={styles.message}>{message}</div>
      </div>
    );
  }

  const playerDuration = 1.2;
  const logoDuration = 2;

  return (
    // We don't need the full overlay div here as the parent RecapSequenceDisplay provides it.
    // We return just the content of the loader.
    <div className="flex flex-col justify-center items-center">
      <div className={styles.loader} key={animationKey}>
        {players.map((player, index) => {
          const startTime = index * playerDuration;
          return (
            <div
              key={`player-${player.id}-${animationKey}`}
              className={styles.avatarLayer}
              style={{
                backgroundImage: `url(${player.avatar})`,
                animationDuration: `${playerDuration}s`,
                animationDelay: `${startTime}s`,
              }}
            />
          );
        })}
        <div
          className={`${styles.avatarLayer} ${styles.logoLayer}`}
          style={{
            animationDuration: `${logoDuration}s`,
            animationDelay: `${players.length * playerDuration}s`,
          }}
        >
           <Image 
              src={logoPath}
              alt="Make it Terrible Logo"
              fill
              className="object-contain"
              data-ai-hint="game logo"
           />
        </div>
      </div>
      
      {message && <div className={styles.message}>{message}</div>}
      
      {players.length > 0 && (
        <div className="text-center mt-4">
            <p className="text-sm text-gray-400">
                Featuring: {players.map(p => p.name).join(', ')}
            </p>
        </div>
      )}
    </div>
  );
}
