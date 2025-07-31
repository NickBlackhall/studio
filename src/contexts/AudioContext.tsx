
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Define the shape of the audio state and the context
interface AudioState {
  currentTrack: string | null;
  isPlaying: boolean;
  isMuted: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  volume: number;
  sfxVolume: number;
  hasUserInteracted: boolean;
}

interface AudioContextType {
  state: AudioState;
  playTrack: (trackName: string) => void;
  stop: () => void;
  toggleMute: () => void;
  toggleMusicMute: () => void;
  toggleSfxMute: () => void;
  setVolume: (volume: number) => void;
  playSfx: (soundName: string) => void;
}

// Define the available music tracks
export const AUDIO_TRACKS: { [key: string]: string } = {
  'lobby-music': '/Sound/music/welcome-lobby-track_01.mp3',
  'game-music': '/Sound/music/in-game-track-2.mp3',
};

// Define available sound effects
export const SOUND_EFFECTS: { [key: string]: string } = {
  'button-click': '/Sound/sound-effects/Button Firm 2_01.wav',
  'card-flip': '/Sound/sound-effects/6-card-deal.wav',
  'boondoggle': '/Sound/sound-effects/devil-laughter.wav',
  'category-select': '/Sound/sound-effects/scenario-select-button.wav',
  'unleash-scenario': '/Sound/sound-effects/Gong_01.mp3',
  'card-submit': '/Sound/sound-effects/quick-woosh_01.wav',
  'crown-winner': '/Sound/sound-effects/we-have-a-winner.mp3',
  'round-winner': '/Sound/sound-effects/round-winner-announcement.mp3',
  'join-game': '/Sound/sound-effects/join-game-button.mp3',
};


// Create the context with a default value
const AudioContext = createContext<AudioContextType | undefined>(undefined);

// The provider component that will wrap our app
export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>({
    currentTrack: null,
    isPlaying: false,
    isMuted: false,
    musicMuted: false,
    sfxMuted: false,
    volume: 0.3,
    sfxVolume: 0.5,
    hasUserInteracted: false,
  });
  
  // This ref helps us wait for the first user interaction before playing audio.
  const isInteractedRef = React.useRef(false);

  const handleUserInteraction = useCallback(() => {
    console.log('🎵 USER INTERACTION DETECTED! State:', { 
      currentTrack: state.currentTrack, 
      isPlaying: state.isPlaying, 
      isMuted: state.isMuted 
    });
    
    if (!isInteractedRef.current) {
      isInteractedRef.current = true;
      console.log('🎵 First interaction - audio now enabled, triggering re-render');
      // Update state so MusicPlayer sees hasUserInteracted = true
      setState(prevState => ({ ...prevState, hasUserInteracted: true }));
    }
  }, [state.currentTrack, state.isPlaying, state.isMuted]);

  useEffect(() => {
    console.log('🎵 Setting up interaction listeners');
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    // Load preferences from localStorage on mount
    const savedMuted = localStorage.getItem('audioMuted');
    const savedMusicMuted = localStorage.getItem('audioMusicMuted');
    const savedSfxMuted = localStorage.getItem('audioSfxMuted');
    const savedVolume = localStorage.getItem('audioVolume');
    const savedSfxVolume = localStorage.getItem('audioSfxVolume');
    
    // Using a function with setState to avoid stale state issues
    setState(prevState => ({
      ...prevState,
      isMuted: savedMuted !== null ? savedMuted === 'true' : prevState.isMuted,
      musicMuted: savedMusicMuted !== null ? savedMusicMuted === 'true' : prevState.musicMuted,
      sfxMuted: savedSfxMuted !== null ? savedSfxMuted === 'true' : prevState.sfxMuted,
      volume: savedVolume !== null ? parseFloat(savedVolume) : prevState.volume,
      sfxVolume: savedSfxVolume !== null ? parseFloat(savedSfxVolume) : prevState.sfxVolume,
    }));
    
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

  const playSfx = useCallback((soundName: string) => {
    if (state.isMuted || state.sfxMuted || !state.hasUserInteracted) return;
    
    const soundSrc = SOUND_EFFECTS[soundName as keyof typeof SOUND_EFFECTS];
    if (!soundSrc) {
      console.warn(`Sound effect "${soundName}" not found.`);
      return;
    }

    const audio = new Audio(soundSrc);
    audio.volume = state.sfxVolume;
    audio.play().catch(error => {
      // This might happen if the interaction hasn't registered yet, though less likely for SFX
      console.warn(`Could not play sound effect "${soundName}":`, error);
    });
  }, [state.isMuted, state.sfxMuted, state.sfxVolume, state.hasUserInteracted]);

  const stop = useCallback(() => {
    setState(prevState => ({ ...prevState, isPlaying: false }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prevState => {
      const newMuted = !prevState.isMuted;
      localStorage.setItem('audioMuted', String(newMuted));
      return { ...prevState, isMuted: newMuted };
    });
  }, []);

  const toggleMusicMute = useCallback(() => {
    setState(prevState => {
      const newMusicMuted = !prevState.musicMuted;
      localStorage.setItem('audioMusicMuted', String(newMusicMuted));
      return { ...prevState, musicMuted: newMusicMuted };
    });
  }, []);

  const toggleSfxMute = useCallback(() => {
    setState(prevState => {
      const newSfxMuted = !prevState.sfxMuted;
      localStorage.setItem('audioSfxMuted', String(newSfxMuted));
      return { ...prevState, sfxMuted: newSfxMuted };
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    const newVolume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('audioVolume', String(newVolume));
    setState(prevState => ({ ...prevState, volume: newVolume }));
  }, []);

  return (
    <AudioContext.Provider value={{ state, playTrack, stop, toggleMute, toggleMusicMute, toggleSfxMute, setVolume, playSfx }}>
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
