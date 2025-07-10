
"use client";
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { PlayerClientState } from '@/lib/types';
import styles from '@/components/layout/AvatarLoadingOverlay.module.css';
import { Loader2 } from 'lucide-react';

// --- Loading Overlay Component (Simplified Fallback) ---
// The main avatar animation is now in its own component.
// This global loader is for simple, quick actions.

const GlobalLoadingFallback = () => {
  const { isGlobalLoading, loadingMessage } = useLoading();
  const [shouldRender, setShouldRender] = useState(false);
  const [opacityClass, setOpacityClass] = useState('opacity-0');
  const FADE_DURATION_MS = 300;

  useEffect(() => {
    let fadeInTimer: NodeJS.Timeout;
    let fadeOutTimer: NodeJS.Timeout;

    if (isGlobalLoading) {
      setShouldRender(true);
      fadeInTimer = setTimeout(() => setOpacityClass('opacity-100'), 50);
    } else {
      setOpacityClass('opacity-0');
      fadeOutTimer = setTimeout(() => setShouldRender(false), FADE_DURATION_MS);
    }

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [isGlobalLoading]);
  
  if (!shouldRender) {
    return null;
  }

  return (
     <div 
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity ease-in-out ${opacityClass}`}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary-foreground mb-4" />
      <p className="text-lg text-primary-foreground font-semibold">{loadingMessage}</p>
    </div>
  );
};


// --- Context Definition & Provider ---

interface LoadingContextType {
  isGlobalLoading: boolean;
  loadingMessage: string;
  playersForLoader: PlayerClientState[]; // Kept for potential future use, but not used by the simple loader
  showGlobalLoader: (options?: { message?: string; players?: PlayerClientState[] }) => void;
  hideGlobalLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [playersForLoader, setPlayersForLoader] = useState<PlayerClientState[]>([]);

  const showGlobalLoader = useCallback((options?: { message?: string; players?: PlayerClientState[] }) => {
    setLoadingMessage(options?.message || "Loading...");
    setPlayersForLoader(options?.players || []);
    setIsGlobalLoading(true);
  }, []);

  const hideGlobalLoader = useCallback(() => {
    setIsGlobalLoading(false);
    setTimeout(() => { // Delay reset to allow fade out
        setLoadingMessage("Loading...");
        setPlayersForLoader([]);
    }, 500);
  }, []);

  return (
    <LoadingContext.Provider value={{ 
      isGlobalLoading, 
      showGlobalLoader, 
      hideGlobalLoader, 
      loadingMessage, 
      playersForLoader 
    }}>
      {children}
      <GlobalLoadingFallback />
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
