
"use client";
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { PlayerClientState } from '@/lib/types';

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
    console.log("GlobalLoader: Showing with options:", options);
    setLoadingMessage(options?.message || "Loading the terribleness...");
    setPlayersForLoader(options?.players || []);
    setIsGlobalLoading(true);
  }, []);

  const hideGlobalLoader = useCallback(() => {
    console.log("GlobalLoader: Hiding");
    setIsGlobalLoading(false);
    // Reset after a short delay to allow for fade-out
    setTimeout(() => {
        setLoadingMessage("Loading...");
        setPlayersForLoader([]);
    }, 500);
  }, []);

  return (
    <LoadingContext.Provider value={{ isGlobalLoading, showGlobalLoader, hideGlobalLoader, loadingMessage, playersForLoader }}>
      {children}
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
