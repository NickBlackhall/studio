
"use client";
import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextType {
  isGlobalLoading: boolean;
  showGlobalLoader: () => void;
  hideGlobalLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const showGlobalLoader = useCallback(() => {
    console.log("GlobalLoader: Showing");
    setIsGlobalLoading(true);
  }, []);
  const hideGlobalLoader = useCallback(() => {
    console.log("GlobalLoader: Hiding");
    setIsGlobalLoading(false);
  }, []);

  return (
    <LoadingContext.Provider value={{ isGlobalLoading, showGlobalLoader, hideGlobalLoader }}>
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
