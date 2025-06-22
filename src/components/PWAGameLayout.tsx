
"use client";

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { AVATARS } from '@/lib/data';
import { addPlayer as addPlayerAction } from '@/app/game/actions';
import type { Tables } from '@/lib/database.types';
import localFont from 'next/font/local';

const imFellFont = localFont({
  src: '../../public/fonts/IMFellEnglishSC-Regular.ttf',
  display: 'swap',
});

interface PWAGameLayoutProps {
  gameId: string;
  onPlayerAdded: (newPlayer: Tables<'players'>) => void;
}

export default function PWAGameLayout({ gameId, onPlayerAdded }: PWAGameLayoutProps) {
  const [name, setName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();

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

  return (
    <div className="pwa-game-container">
      <form onSubmit={handleJoinSubmit} className="w-full h-full flex flex-col justify-between">
        {/* TOP SECTION - Name Input */}
        <div className="top-section">
          <div className="name-input-container">
            <input 
              id="name"
              name="name"
              type="text"
              placeholder="YOUR NAME"
              className={`name-input ${imFellFont.className}`}
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              <Image src={AVATARS[avatarIndex]} alt="Selected Avatar" width={272} height={272} data-ai-hint="player avatar" priority />
            </div>
            
            <button type="button" onClick={() => handleAvatarChange(1)} className="carousel-btn" aria-label="Next avatar">
              →
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION - Join Button */}
        <div className="bottom-section">
          <button
            type="submit"
            className="bg-transparent border-none p-0 disabled:opacity-50 transition-transform hover:scale-105"
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
