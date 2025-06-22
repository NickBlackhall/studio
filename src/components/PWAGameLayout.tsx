"use client";

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { AVATARS } from '@/lib/data';
import { addPlayer as addPlayerAction } from '@/app/game/actions';
import type { Tables } from '@/lib/database.types';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/contexts/LoadingContext';

interface PWAGameLayoutProps {
  gameId: string;
  onPlayerAdded: (newPlayer: Tables<'players'>) => void;
}

export default function PWAGameLayout({ gameId, onPlayerAdded }: PWAGameLayoutProps) {
  const [name, setName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const { showGlobalLoader } = useLoading();

  const handleAvatarChange = (direction: number) => {
    const newIndex = (avatarIndex + direction + AVATARS.length) % AVATARS.length;
    setAvatarIndex(newIndex);
  };
  
  const handleJoinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name Required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (avatarIndex === 0) {
      toast({ title: "Avatar Required", description: "Please select an avatar other than the question mark.", variant: "destructive" });
      return;
    }
    
    startTransition(async () => {
      try {
        const selectedAvatar = AVATARS[avatarIndex];
        const newPlayer = await addPlayerAction(name, selectedAvatar);
        if (newPlayer) {
          onPlayerAdded(newPlayer);
        } else {
          toast({ title: "Join Error", description: "Could not add player to the game. It might have already started.", variant: "destructive"});
        }
      } catch (error: any) {
        toast({ title: "Error Adding Player", description: error.message || String(error), variant: "destructive"});
      }
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  };

  const isReadyToJoin = name.trim() && avatarIndex !== 0;

  return (
    <div className="pwa-game-container">
      {/* Invisible button over "MAYHEM" */}
      <button
        type="button"
        onClick={() => {
          showGlobalLoader();
          router.push('/');
        }}
        className="absolute top-[12vh] left-1/2 -translate-x-1/2 w-[60vw] max-w-[250px] h-[8vh] z-20"
        aria-label="Go back to welcome screen"
        title="Go back to welcome screen"
      />
      <form onSubmit={handleJoinSubmit} className="w-full h-full flex flex-col justify-between">
        {/* TOP SECTION - Name Input */}
        <div className="top-section">
          <div className="name-input-container">
            <input 
              id="name"
              name="name"
              type="text"
              placeholder="YOUR NAME"
              className="name-input"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              required
            />
          </div>
        </div>

        {/* MIDDLE SECTION - Avatar Carousel */}
        <div className="middle-section">
          <div className="avatar-carousel-container">
            <button type="button" onClick={() => handleAvatarChange(-1)} className="carousel-btn" aria-label="Previous avatar">
              ←
            </button>
            
            <div className="avatar-display">
              <Image src={AVATARS[avatarIndex]} alt="Selected Avatar" width={170} height={170} data-ai-hint="player avatar" priority />
            </div>
            
            <button type="button" onClick={() => handleAvatarChange(1)} className="carousel-btn" aria-label="Next avatar">
              →
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION - Join Button */}
        <div className="bottom-section">
          {isReadyToJoin && (
            <div className="relative join-game-button animate-slow-scale-pulse">
              <button
                type="submit"
                className="bg-transparent border-none p-0 group"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="text-white text-2xl font-bold uppercase animate-pulse">Joining...</span>
                ) : (
                  <Image
                    src="/ui/join-game-button.png"
                    alt="Join the Mayhem"
                    width={252}
                    height={95}
                    className="object-contain drop-shadow-xl"
                    data-ai-hint="join button"
                    priority
                  />
                )}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Background Poster */}
      <div className="background-poster">
        <Image 
          src="/backgrounds/join-screen-2.jpg"
          alt="Make It Terrible Game Background"
          layout="fill"
          objectFit="cover"
          objectPosition="center"
          className="poster-image"
          data-ai-hint="skull poster"
          priority
        />
      </div>
    </div>
  );
}
