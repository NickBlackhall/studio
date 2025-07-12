'use client';

import { useEffect, useRef } from 'react';
import { useAudio, AUDIO_TRACKS } from '@/contexts/AudioContext';

export default function MusicPlayer() {
  const { state } = useAudio();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, isPlaying, isMuted, volume } = state;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && currentTrack && !isMuted) {
      const trackUrl = AUDIO_TRACKS[currentTrack as keyof typeof AUDIO_TRACKS];
      
      // Only change src if it's different to prevent re-buffering
      if (audio.src !== window.location.origin + trackUrl) {
        audio.src = trackUrl;
      }
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Autoplay was prevented. This is common before user interaction.
          // The useAudio context handles waiting for the first interaction.
          console.warn("Audio play prevented:", error);
        });
      }
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return <audio ref={audioRef} loop style={{ display: 'none' }} />;
}
