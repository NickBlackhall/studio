
"use client";
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { PlayerClientState } from '@/lib/types';
import styles from '@/components/layout/AvatarLoadingOverlay.module.css';
import { Button } from '@/components/ui/button';
import { SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Loading Overlay Component ---

const AvatarLoadingOverlayInternal = () => {
  const { 
    isGlobalLoading, 
    isWorkComplete, 
    loadingMessage, 
    playersForLoader,
    finishLoading, // Get the function to actually hide the loader
  } = useLoading();
  
  const [showSkip, setShowSkip] = useState(false);
  const minWaitTimer = useRef<NodeJS.Timeout>();
  const fullDurationTimer = useRef<NodeJS.Timeout>();

  const players = playersForLoader || [];
  const logoPath = "/ui/new-logo.png";
  
  const playerDuration = 1.2;
  const logoDuration = 2;
  const totalDuration = (players.length * playerDuration) + logoDuration;
  const MINIMUM_WAIT_MS = 5000;

  useEffect(() => {
    if (isGlobalLoading) {
      setShowSkip(false); // Reset skip button visibility on new load
      
      // Timer for minimum duration
      minWaitTimer.current = setTimeout(() => {
        setShowSkip(true); // Allow skip button to appear after 5s
      }, MINIMUM_WAIT_MS);

      // Timer for the full animation sequence
      fullDurationTimer.current = setTimeout(() => {
        finishLoading();
      }, totalDuration * 1000);

    }

    // Cleanup timers on unmount or when loading is finished
    return () => {
      clearTimeout(minWaitTimer.current);
      clearTimeout(fullDurationTimer.current);
    };
  }, [isGlobalLoading, totalDuration, finishLoading]);

  // If not loading, render nothing
  if (!isGlobalLoading) {
    return null;
  }
  
  // If there are no players, use the simple fallback loader
  if (players.length === 0) {
    return <FallbackLoader message={loadingMessage} />;
  }

  // Determine if the skip button should be rendered and clickable
  const canSkip = showSkip && isWorkComplete;

  return (
    <div className={styles.overlay}>
      <div className={styles.loader}>
        {players.map((player, index) => {
          const startTime = index * playerDuration;
          return (
            <div
              key={`player-${player.id}`}
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

      <AnimatePresence>
        {canSkip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-10"
          >
            <Button
              onClick={finishLoading}
              variant="outline"
              className="bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
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
  isWorkComplete: boolean;
  loadingMessage: string;
  playersForLoader: PlayerClientState[];
  showGlobalLoader: (options?: { message?: string; players?: PlayerClientState[] }) => void;
  hideGlobalLoader: () => void; // This will now mean "work is complete"
  finishLoading: () => void; // This will actually hide the overlay
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isWorkComplete, setIsWorkComplete] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [playersForLoader, setPlayersForLoader] = useState<PlayerClientState[]>([]);

  const showGlobalLoader = useCallback((options?: { message?: string; players?: PlayerClientState[] }) => {
    setLoadingMessage(options?.message || "Loading the terribleness...");
    setPlayersForLoader(options?.players || []);
    setIsWorkComplete(false); // Reset work status
    setIsGlobalLoading(true); // Show the loader
  }, []);

  const hideGlobalLoader = useCallback(() => {
    // This function is now just a signal that the async operation is done.
    setIsWorkComplete(true);
  }, []);
  
  const finishLoading = useCallback(() => {
    // This is the function that actually turns off the loader display
    setIsGlobalLoading(false);
    // Reset state for next time
    setTimeout(() => {
        setLoadingMessage("Loading...");
        setPlayersForLoader([]);
        setIsWorkComplete(false);
    }, 500); // Delay to allow fade-out
  }, []);

  return (
    <LoadingContext.Provider value={{ 
      isGlobalLoading, 
      isWorkComplete,
      showGlobalLoader, 
      hideGlobalLoader,
      finishLoading,
      loadingMessage, 
      playersForLoader 
    }}>
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
