"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { PlayerClientState } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import AvatarLoadingSequence from '@/components/game/AvatarLoadingSequence';

// Loading states enum for better type safety
export type LoadingState = 
  | 'idle'
  | 'initializing'
  | 'starting_game'
  | 'transitioning'
  | 'loading_game_data'
  | 'navigation';

interface LoadingContextType {
  loadingState: LoadingState;
  loadingMessage: string;
  playersForLoader: PlayerClientState[];
  showLoader: (state: LoadingState, options?: { message?: string; players?: PlayerClientState[] }) => void;
  hideLoader: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Unified Loading Overlay Component
const UnifiedLoadingOverlay = () => {
  const { loadingState, loadingMessage, playersForLoader, isLoading } = useLoading();
  const [shouldRender, setShouldRender] = useState(false);
  const [opacityClass, setOpacityClass] = useState('opacity-0');
  
  const FADE_DURATION_MS = 300;

  useEffect(() => {
    let fadeInTimer: NodeJS.Timeout;
    let fadeOutTimer: NodeJS.Timeout;

    if (isLoading) {
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
  }, [isLoading]);

  if (!shouldRender) return null;

  // Different loading experiences based on state
  const renderLoadingContent = () => {
    switch (loadingState) {
      case 'starting_game':
        if (playersForLoader.length > 0) {
          return (
            <AvatarLoadingSequence 
              players={playersForLoader} 
              message={<>Starting the game...<br />Dealing cards and assigning roles!</>}
            />
          );
        }
        return (
          <div className="flex flex-col items-center">
            <Loader2 className="h-16 w-16 animate-spin text-white mb-6" />
            <p className="text-2xl text-white font-semibold text-center">{loadingMessage}</p>
          </div>
        );

      case 'transitioning':
        return (
          <div className="flex flex-col items-center">
            <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mb-4" />
            <p className="text-xl text-white font-semibold">{loadingMessage}</p>
          </div>
        );

      case 'loading_game_data':
      case 'initializing':
      case 'navigation':
      default:
        return (
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />
            <p className="text-lg text-white font-semibold">{loadingMessage}</p>
          </div>
        );
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm transition-opacity ease-in-out ${opacityClass}`}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
    >
      {renderLoadingContent()}
    </div>
  );
};

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [playersForLoader, setPlayersForLoader] = useState<PlayerClientState[]>([]);

  const showLoader = useCallback((state: LoadingState, options?: { message?: string; players?: PlayerClientState[] }) => {
    setLoadingState(state);
    setLoadingMessage(options?.message || getDefaultMessage(state));
    setPlayersForLoader(options?.players || []);
  }, []);

  const hideLoader = useCallback(() => {
    setLoadingState('idle');
    // Small delay to allow fade out
    setTimeout(() => {
      setLoadingMessage("Loading...");
      setPlayersForLoader([]);
    }, 400);
  }, []);

  const isLoading = loadingState !== 'idle';

  return (
    <LoadingContext.Provider value={{ 
      loadingState,
      loadingMessage, 
      playersForLoader,
      showLoader,
      hideLoader,
      isLoading
    }}>
      {children}
      <UnifiedLoadingOverlay />
    </LoadingContext.Provider>
  );
}

// Helper function for default messages
function getDefaultMessage(state: LoadingState): string {
  switch (state) {
    case 'initializing': return 'Initializing game...';
    case 'starting_game': return 'Starting the game...';
    case 'transitioning': return 'Loading...';
    case 'loading_game_data': return 'Loading game data...';
    case 'navigation': return 'Navigating...';
    default: return 'Loading...';
  }
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}