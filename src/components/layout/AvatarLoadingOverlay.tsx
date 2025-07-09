
"use client";

import { useEffect, useState } from 'react';
import type { PlayerClientState } from '@/lib/types';
import styles from './AvatarLoadingOverlay.module.css';
import { useLoading } from '@/contexts/LoadingContext';

const AvatarLoadingOverlay = () => {
  const { isGlobalLoading, loadingMessage, playersForLoader } = useLoading();
  const [animationKey, setAnimationKey] = useState(0);

  const players = playersForLoader || [];
  const logoPath = "/new-logo.png";

  useEffect(() => {
    if (isGlobalLoading) {
      setAnimationKey(prev => prev + 1);
    }
  }, [isGlobalLoading, players.length]);

  if (!isGlobalLoading) return null;

  if (players.length === 0) {
    return <FallbackLoader message={loadingMessage} />;
  }

  const playerDuration = 1.2; // slightly longer per player
  const logoDuration = 2; // 2 seconds for logo
  const totalDuration = (players.length * playerDuration) + logoDuration;

  return (
    <div className={styles.overlay}>
      <div className={styles.loader} key={animationKey}>
        {players.map((player, index) => {
          const startTime = index * playerDuration;
          const endTime = startTime + playerDuration;
          const startPercent = (startTime / totalDuration) * 100;
          const endPercent = (endTime / totalDuration) * 100;

          return (
            <div
              key={`player-${player.id}-${animationKey}`}
              className={styles.avatarLayer}
              style={{
                backgroundImage: `url(${player.avatar})`, // Corrected path
                animationDuration: `${totalDuration}s`,
                '--start-percent': `${Math.max(0, startPercent - 0.5)}%`,
                '--show-start': `${startPercent}%`,
                '--show-end': `${endPercent}%`,
                '--end-percent': `${Math.min(100, endPercent + 0.5)}%`,
              } as React.CSSProperties}
            />
          );
        })}
        
        <div
          className={`${styles.avatarLayer} ${styles.logoLayer}`}
          style={{
            backgroundImage: `url(${logoPath})`,
            animationDuration: `${totalDuration}s`,
            '--logo-start': `${((players.length * playerDuration) / totalDuration) * 100}%`,
          } as React.CSSProperties}
        />
      </div>
      
      <div className={styles.message}>{loadingMessage}</div>
      
      {players.length > 0 && (
        <div className={styles.playerList}>
          Featuring: {players.map(p => p.name).join(", ")}
        </div>
      )}
    </div>
  );
};

const FallbackLoader = ({ message }: { message: string }) => (
  <div className={styles.overlay}>
    <div className={styles.fallbackSpinner} />
    <div className={styles.message}>{message}</div>
  </div>
);

export default AvatarLoadingOverlay;
