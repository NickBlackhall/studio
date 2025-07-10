
"use client";
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { PlayerClientState } from '@/lib/types';
import styles from '@/components/layout/AvatarLoadingOverlay.module.css';

// --- Loading Overlay Component ---

const AvatarLoadingOverlayInternal = () => {
  const { isGlobalLoading, loadingMessage, playersForLoader } = useLoading();
  const [animationKey, setAnimationKey] = useState(0);

  const players = playersForLoader || [];
  const logoPath = "/ui/new-logo.png";

  useEffect(() => {
    if (isGlobalLoading && players.length > 0) {
      setAnimationKey(prev => prev + 1);
    }
  }, [isGlobalLoading, players.length]);

  if (!isGlobalLoading) return null;

  if (players.length === 0) {
    return <FallbackLoader message={loadingMessage} />;
  }

  const playerDuration = 1.2;
  const logoDuration = 2;

  return (
    <div className={styles.overlay}>
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
            backgroundImage: `url(${logoPath})`,
            animationDuration: `${logoDuration}s`,
            animationDelay: `${players.length * playerDuration}s`,
          }}
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


// --- Context Definition & Provider ---

interface LoadingContextType {
  isGlobalLoading: boolean;
  loadingMessage: string;
  playersForLoader: PlayerClientState[];
  showGlobalLoader: (options?: { message?: string; players?: PlayerClientState[] }) => void;
  hideGlobalLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [playersForLoader, setPlayersForLoader] = useState<PlayerClientState[]>([]);

  const showGlobalLoader = useCallback((options?: { message?: string; players?: PlayerClientState[] }) => {
    setLoadingMessage(options?.message || "Loading the terribleness...");
    setPlayersForLoader(options?.players || []);
    setIsGlobalLoading(true);
  }, []);

  const hideGlobalLoader = useCallback(() => {
    setIsGlobalLoading(false);
    setTimeout(() => {
        setLoadingMessage("Loading...");
        setPlayersForLoader([]);
    }, 500);
  }, []);

  return (
    <LoadingContext.Provider value={{ isGlobalLoading, showGlobalLoader, hideGlobalLoader, loadingMessage, playersForLoader }}>
      {children}
      <AvatarLoadingOverlayInternal />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
