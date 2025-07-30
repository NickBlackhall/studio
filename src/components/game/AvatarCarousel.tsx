
"use client";

import type { ForwardedRef } from "react";
import { useState, useEffect, forwardRef } from "react";
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, usePresence, wrap } from "framer-motion";
import { useAudio } from '@/contexts/AudioContext';

interface AvatarCarouselProps {
  avatars: string[];
  initialAvatar?: string;
  onAvatarSelect: (avatarPath: string) => void;
  className?: string;
}

const Slide = forwardRef(function Slide(
    { avatarPath, direction }: { avatarPath: string; direction: number },
    ref: ForwardedRef<HTMLDivElement>
) {
    const [isPresent, safeToRemove] = usePresence();

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
        }),
    };

    useEffect(() => {
        !isPresent && setTimeout(safeToRemove, 300); // Match transition duration
    }, [isPresent, safeToRemove]);

    return (
        <motion.div
            ref={ref}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
                x: { type: "spring", stiffness: 300, damping: 30, duration: 0.3 },
                opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            className="absolute w-full h-full flex items-center justify-center"
        >
            <Image
                src={avatarPath}
                alt="Selected Avatar"
                width={100}
                height={100}
                className="object-contain rounded-md"
                priority
                style={{ width: '100px', height: '100px' }}
            />
        </motion.div>
    );
});
Slide.displayName = "Slide";


export default function AvatarCarousel({
  avatars,
  initialAvatar,
  onAvatarSelect,
  className
}: AvatarCarouselProps) {
  const initialIndex = initialAvatar && avatars.length > 0 
    ? Math.max(0, avatars.indexOf(initialAvatar)) 
    : (avatars.length > 0 ? 0 : -1);

  const [[page, direction], setPage] = useState([initialIndex, 0]);
  const { playSfx } = useAudio();

  useEffect(() => {
    const newInitialIndex = initialAvatar && avatars.length > 0 
      ? Math.max(0, avatars.indexOf(initialAvatar)) 
      : (avatars.length > 0 ? 0 : -1);
    
    if (newInitialIndex !== -1 && page !== newInitialIndex) {
      setPage([newInitialIndex, page > newInitialIndex ? -1 : 1]);
    }
    // Call onAvatarSelect with the current valid avatar when component mounts or avatars change
    if (avatars.length > 0 && newInitialIndex !== -1) {
        if (avatars[newInitialIndex]) {
            onAvatarSelect(avatars[newInitialIndex]);
        }
    } else if (avatars.length > 0) { // Fallback if initialAvatar not found
        onAvatarSelect(avatars[0]);
        if (page !== 0) setPage([0,0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatar, JSON.stringify(avatars)]); // Watch avatars array content

  const avatarIndex = avatars.length > 0 ? wrap(0, avatars.length, page) : -1;

  const paginate = (newDirection: number) => {
    if (avatars.length === 0) return;
    playSfx('button-click');
    const newPageIndex = page + newDirection;
    setPage([newPageIndex, newDirection]);
    const nextAvatarIndex = wrap(0, avatars.length, newPageIndex);
    onAvatarSelect(avatars[nextAvatarIndex]);
  };

  if (!avatars || avatars.length === 0) {
    return <div className="text-center text-muted-foreground py-4">No avatars available.</div>;
  }
  
  if (avatarIndex === -1) {
     return <div className="text-center text-muted-foreground py-4">Loading avatars...</div>;
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 w-full", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous Avatar"
        onClick={() => paginate(-1)}
        className="shrink-0 bg-background/70 hover:bg-muted border-primary/30 z-10"
      >
        <ChevronLeft className="h-6 w-6 text-primary" />
      </Button>

      <div className="relative w-28 h-28 overflow-hidden rounded-md flex items-center justify-center">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {avatars[avatarIndex] && (
            <Slide
              key={page} 
              avatarPath={avatars[avatarIndex]}
              direction={direction}
            />
          )}
        </AnimatePresence>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next Avatar"
        onClick={() => paginate(1)}
        className="shrink-0 bg-background/70 hover:bg-muted border-primary/30 z-10"
      >
        <ChevronRight className="h-6 w-6 text-primary" />
      </Button>
    </div>
  );
}
