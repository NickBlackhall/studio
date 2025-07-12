
'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

// Define the shape of the audio state and the context
interface AudioState {
  currentTrack: string | null;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
}

interface AudioContextType {
  state: AudioState;
  playTrack: (trackName: string) => void;
  stop: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
}

// Define the available music tracks
export const AUDIO_TRACKS: { [key: string]: string } = {
  'lobby-music': '/Sound/music/welcome-lobby-track.mp3',
  'game-music': '/Sound/music/in-game-track.mp3',
};

// Create the context with a default value
const AudioContext = createContext<AudioContextType | undefined>(undefined);

// The provider component that will wrap our app
export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentTrack: null,
    isPlaying: false,
    isMuted: false,
    volume: 0.3,
  });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInteractedRef = useRef(false);

  const handleUserInteraction = useCallback(() => {
    isInteractedRef.current = true;
    window.removeEventListener('click', handleUserInteraction);
    window.removeEventListener('keydown', handleUserInteraction);
  }, []);

  useEffect(() => {
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    // Load preferences from localStorage on mount
    const savedMuted = localStorage.getItem('audioMuted');
    const savedVolume = localStorage.getItem('audioVolume');
    if (savedMuted !== null) {
      setState(prevState => ({ ...prevState, isMuted: savedMuted === 'true' }));
    }
    if (savedVolume !== null) {
      setState(prevState => ({ ...prevState, volume: parseFloat(savedVolume) }));
    }
    
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [handleUserInteraction]);
  
  const playTrack = useCallback((trackName: string) => {
    setState(prevState => {
      // If it's the same track and already playing, do nothing.
      if (prevState.currentTrack === trackName && prevState.isPlaying) {
        return prevState;
      }
      return { ...prevState, currentTrack: trackName, isPlaying: true };
    });
  }, []);

  const stop = useCallback(() => {
    setState(prevState => ({ ...prevState, isPlaying: false, currentTrack: null }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prevState => {
      const newMuted = !prevState.isMuted;
      localStorage.setItem('audioMuted', String(newMuted));
      return { ...prevState, isMuted: newMuted };
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    const newVolume = Math.max(0, Math.min(1, volume));
    setState(prevState => {
      localStorage.setItem('audioVolume', String(newVolume));
      return { ...prevState, volume: newVolume };
    });
  }, []);

  return (
    <AudioContext.Provider value={{ state, playTrack, stop, toggleMute, setVolume }}>
      {children}
    </AudioContext.Provider>
  );
}

// Custom hook to easily access the audio context
export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
