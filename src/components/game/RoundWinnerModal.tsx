
"use client";

import Image from 'next/image';
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import type { PlayerClientState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface RoundWinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastWinnerPlayer?: PlayerClientState;
  lastWinnerCardText?: string;
}

export default function RoundWinnerModal({
  isOpen,
  onClose,
  lastWinnerPlayer,
  lastWinnerCardText
}: RoundWinnerModalProps) {

  const renderAvatar = (avatarPath: string | null | undefined, playerName: string) => {
    if (avatarPath && avatarPath.startsWith('/')) {
      return (
        <Image
          src={avatarPath}
          alt={`${playerName}'s avatar`}
          width={64}
          height={64}
          className="rounded-md object-contain border-2 border-black"
          data-ai-hint="player avatar"
        />
      );
    }
    return <span className="text-5xl">{avatarPath || '🤔'}</span>;
  };

  if (!isOpen || !lastWinnerPlayer || !lastWinnerCardText) {
    return null;
  }

  // Note: This component might be deprecated or heavily modified if the new RecapSequenceDisplay fully replaces it.
  // The animation classes here might conflict or become irrelevant.
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay /> 
        <DialogContent
          className={cn(
            "sm:max-w-md md:max-w-lg",
            "bg-transparent p-0 border-none shadow-none", 
            "overflow-visible", 
            "z-[60]", 
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-bottom-0 data-[state=open]:slide-in-from-left-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-bottom-0 data-[state=closed]:slide-out-to-left-0",
            "duration-1000" // Explicitly kept from previous, might need adjustment
          )}
          onInteractOutside={(e) => e.preventDefault()} 
        >
          <DialogTitle className="sr-only">Round Winner</DialogTitle>
          
          <div
            className={cn(
              "bg-yellow-400 text-black rounded-xl shadow-2xl overflow-hidden",
              "p-6 md:p-8 flex flex-col items-center justify-center space-y-4 md:space-y-6 w-full"
            )}
          >
            <div className="w-full max-w-xs md:max-w-sm">
              <Image
                src="/round-winner-banner.png"
                alt="Round Winner!"
                width={400}
                height={150}
                className="object-contain"
                data-ai-hint="winner banner"
                priority
              />
            </div>

            <div className="flex items-center space-x-3 md:space-x-4">
              {renderAvatar(lastWinnerPlayer.avatar, lastWinnerPlayer.name)}
              <p className="text-2xl md:text-3xl font-bold truncate">
                {lastWinnerPlayer.name}
              </p>
            </div>

            <div className="w-full max-w-sm md:max-w-md p-4 bg-black rounded-lg border-2 border-red-500 shadow-md">
              <p className="text-white text-lg md:text-xl font-medium leading-tight">
                {lastWinnerCardText}
              </p>
            </div>

            <p className="text-sm text-black/70 animate-pulse pt-2">
              Next round starting soon...
            </p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
