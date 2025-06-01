
"use client";

import { AnimatePresence, motion, usePresence, wrap } from "motion/react";
import type { ForwardedRef } from "react";
import { useState, useEffect, forwardRef } from "react";
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

interface AvatarCarouselProps {
  avatars: string[];
  initialAvatar?: string;
  onAvatarSelect: (avatarPath: string) => void;
  className?: string;
}

const MotionImage = motion(Image);

const Slide = forwardRef(function Slide(
    { avatarPath, altText }: { avatarPath: string, altText: string },
    ref: ForwardedRef<HTMLDivElement>
) {
    const [isPresent, safeToRemove] = usePresence();
    const direction = typeof window !== 'undefined' ? (window as any).motionDirection : 0; // A bit of a hack to get direction if needed

    useEffect(() => {
        if (!isPresent && safeToRemove) {
            safeToRemove();
        }
    }, [isPresent, safeToRemove]);

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{
                opacity: 1,
                x: 0,
                transition: {
                    delay: 0.1, // Slightly reduced delay
                    type: "spring",
                    stiffness: 300, // A bit stiffer for quicker settle
                    damping: 30,    // Adjusted damping
                    mass: 0.5,      // Lighter mass
                },
            }}
            exit={{ opacity: 0, x: direction * -100, transition: { duration: 0.2 } }}
            className="absolute w-full h-full flex items-center justify-center"
        >
            <MotionImage
                src={avatarPath}
                alt={altText}
                width={100}
                height={100}
                className="object-contain rounded-md"
                priority // Ensures the visible avatar loads quickly
            />
        </motion.div>
    );
});

export default function AvatarCarousel({
  avatars,
  initialAvatar,
  onAvatarSelect,
  className
}: AvatarCarouselProps) {
  const initialIndex = initialAvatar ? Math.max(0, avatars.indexOf(initialAvatar)) : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Ensure parent is notified of initial selection
  useEffect(() => {
    if (avatars.length > 0) {
      onAvatarSelect(avatars[currentIndex]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount with the initial currentIndex

  const handleNavigation = (newDirection: 1 | -1) => {
    if (avatars.length === 0) return;
    // Temporary store direction for animations using a global-like hack, as usePresenceData is not directly used.
    // This is not ideal but works for this specific structure.
    (window as any).motionDirection = newDirection; 

    const nextIndex = wrap(0, avatars.length -1, currentIndex + newDirection);
    setCurrentIndex(nextIndex);
    setDirection(newDirection);
    onAvatarSelect(avatars[nextIndex]);
  };

  if (!avatars || avatars.length === 0) {
    return <div className="text-center text-muted-foreground">No avatars available.</div>;
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 w-full", className)}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous Avatar"
        onClick={() => handleNavigation(-1)}
        className="shrink-0 bg-background/70 hover:bg-muted border-primary/30"
      >
        <ChevronLeft className="h-6 w-6 text-primary" />
      </Button>

      <div className="relative w-32 h-32 overflow-hidden rounded-md flex items-center justify-center">
        <AnimatePresence custom={direction} initial={false} mode="sync">
          <Slide
            key={currentIndex} // Important for AnimatePresence to detect changes
            avatarPath={avatars[currentIndex]}
            altText={`Avatar ${currentIndex + 1}`}
          />
        </AnimatePresence>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Next Avatar"
        onClick={() => handleNavigation(1)}
        className="shrink-0 bg-background/70 hover:bg-muted border-primary/30"
      >
        <ChevronRight className="h-6 w-6 text-primary" />
      </Button>
    </div>
  );
}
