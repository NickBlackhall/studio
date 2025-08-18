"use client";

import React from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface LobbyStartButtonProps {
  showStartButton: boolean;
  isProcessingAction: boolean;
  onStartGame: () => void;
}

export default function LobbyStartButton({ 
  showStartButton, 
  isProcessingAction, 
  onStartGame 
}: LobbyStartButtonProps) {
  if (!showStartButton) return null;

  return (
    <button 
      onClick={onStartGame} 
      disabled={isProcessingAction} 
      className="group animate-slow-scale-pulse disabled:animate-none disabled:opacity-70"
      data-testid="start-game-button"
    >
      {isProcessingAction ? (
        <div className="h-[71.52px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      ) : (
        <Image 
          src="/ui/start-game-button.png" 
          alt="Start the Mayhem" 
          width={189.84 * 1.2 * 1.2} 
          height={71.52 * 1.2 * 1.2} 
          className="object-contain drop-shadow-xl" 
          data-ai-hint="start button" 
          priority 
        />
      )}
    </button>
  );
}