
"use client";

import * as MotionForReact from "motion/react";
import { wrap } from "motion";
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

const MotionImage = MotionForReact.motion(Image);

const Slide = forwardRef(function Slide(
    { avatarPath, altText }: { avatarPath: string, altText: string },
    ref: ForwardedRef<HTMLDivElement>
) {
    const [isPresent, safeToRemove] = MotionForReact.usePresence();
    const direction = typeof window !== 'undefined' ? (window as any).motionDirection : 0;

    useEffect(() => {
        if (!isPresent && safeToRemove) {
            safeToRemove();
        }
    }, [isPresent, safeToRemove]);

    return (
        <MotionForReact.motion.div
            ref={ref}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{
                opacity: 1,
                x: 0,
                transition: {
                    delay: 0.1,
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 0.5,
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
                priority
            />
        </MotionForReact.motion.div>
    );
});
Slide.displayName = "Slide";

export default function AvatarCarousel({
  avatars,
  initialAvatar,
  onAvatarSelect,
  className
}: AvatarCarouselProps) {
  const initialIndex = initialAvatar ? Math.max(0, avatars.indexOf(initialAvatar)) : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1); // direction for animation

  useEffect(() => {
    if (avatars.length > 0) {
      // Ensure initialAvatar is selected if provided and valid
      const validInitialIndex = initialAvatar ? avatars.indexOf(initialAvatar) : -1;
      const startIndex = validInitialIndex !== -1 ? validInitialIndex : 0;
      if (currentIndex !== startIndex) { // Avoid redundant call if already set
        setCurrentIndex(startIndex);
      }
      onAvatarSelect(avatars[startIndex]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatar, avatars]); // Ensure effect runs if initialAvatar or avatars change

  const handleNavigation = (newDirection: 1 | -1) => {
    if (avatars.length === 0) return;
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
        <MotionForReact.AnimatePresence custom={direction} initial={false} mode="sync">
          <Slide
            key={currentIndex} // Ensure key changes to trigger AnimatePresence
            avatarPath={avatars[currentIndex]}
            altText={`Avatar ${currentIndex + 1}`}
          />
        </MotionForReact.AnimatePresence>
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
