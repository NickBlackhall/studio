"use client";

import React from 'react';
import Image from 'next/image';

interface LobbyLayoutProps {
  children: React.ReactNode;
  onOpenMenu: () => void;
}

export default function LobbyLayout({ children, onOpenMenu }: LobbyLayoutProps) {
  return (
    <div className="w-full h-screen animate-in fade-in duration-700 ease-out">
      <div className="relative w-full h-full">
        <Image 
          src="/backgrounds/lobby-poster.jpg" 
          alt="Lobby background" 
          fill 
          className="poster-image" 
          data-ai-hint="lobby poster" 
        />
        <div className="absolute top-[23%] left-[10%] right-[10%] h-[68%] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 ease-out" data-testid="lobby-interface">
          {children}
        </div>
        <div className="absolute bottom-[2%] left-0 right-0 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500 ease-out">
          <button onClick={onOpenMenu} className="bg-transparent border-none p-0">
            <Image 
              src="/ui/menu-button-v2.png" 
              alt="Game Menu" 
              width={118} 
              height={44} 
              className="object-contain" 
              data-ai-hint="menu button" 
              priority 
            />
          </button>
        </div>
      </div>
    </div>
  );
}