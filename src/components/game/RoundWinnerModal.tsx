
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay /> {/* Uses default styling from ui/dialog.tsx which includes bg-black/80 */}
        <DialogContent
          className={cn(
            "p-6 md:p-8 sm:max-w-md md:max-w-lg border-none shadow-2xl", // Standard padding applied here
            "bg-yellow-400 text-black rounded-xl overflow-hidden", // DialogContent itself is yellow
            "flex flex-col items-center justify-center" // For centering content
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Round Winner</DialogTitle>
          
          {/* Content directly inside the yellow DialogContent */}
          <div className="relative flex flex-col items-center justify-center text-center space-y-4 md:space-y-6 w-full">
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
