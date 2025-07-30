'use client';

import { useEffect, useRef } from 'react';
import { useAudio, AUDIO_TRACKS } from '@/contexts/AudioContext';

export default function MusicPlayer() {
  const { state } = useAudio();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTrack, isPlaying, isMuted, musicMuted, volume, hasUserInteracted } = state;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('🎵 MusicPlayer debug:', {
      isPlaying,
      currentTrack,
      isMuted,
      musicMuted,
      hasInteracted: hasUserInteracted,
      audioSrc: audio.src
    });

    if (isPlaying && currentTrack && !isMuted && !musicMuted && hasUserInteracted) {
      const trackUrl = AUDIO_TRACKS[currentTrack as keyof typeof AUDIO_TRACKS];
      console.log('🎵 Attempting to play:', trackUrl);
      
      // Only change src if it's different to prevent re-buffering
      if (audio.src !== window.location.origin + trackUrl) {
        audio.src = trackUrl;
        console.log('🎵 Set audio src to:', audio.src);
      }
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🎵 Audio started successfully');
            console.log('🎵 Audio element state:', {
              paused: audio.paused,
              currentTime: audio.currentTime,
              duration: audio.duration,
              volume: audio.volume,
              muted: audio.muted
            });
          })
          .catch(error => {
            console.warn("🎵 Audio play prevented:", error);
          });
      }
    } else {
      audio.pause();
      console.log('🎵 Audio paused');
    }
  }, [currentTrack, isPlaying, isMuted, musicMuted, hasUserInteracted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return <audio ref={audioRef} loop style={{ display: 'none' }} />;
}
