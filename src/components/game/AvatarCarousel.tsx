
"use client";

// Removed: import { wrap } from "motion"; // Use wrap from the root 'motion' package
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

// Local implementation of the wrap function
const wrap = (min: number, max: number, value: number): number => {
  const rangeSize = max - min;
  return ((((value - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

// Simplified Slide component (no animations for now)
const Slide = forwardRef(function Slide(
    { avatarPath, altText }: { avatarPath: string, altText: string },
    ref: ForwardedRef<HTMLDivElement>
) {
    return (
        <div
            ref={ref}
            className="absolute w-full h-full flex items-center justify-center" // Kept centering styles
        >
            <Image
                src={avatarPath}
                alt={altText}
                width={100} // Fixed width
                height={100} // Fixed height
                className="object-contain rounded-md" // Ensure image scales nicely and has rounded corners
                priority // Keep priority for LCP optimization if applicable
                style={{ width: '100px', height: '100px' }} // Explicit style to match props
            />
        </div>
    );
});
Slide.displayName = "Slide";


export default function AvatarCarousel({
  avatars,
  initialAvatar,
  onAvatarSelect,
  className
}: AvatarCarouselProps) {
  // Determine the initial index safely, defaulting to 0 if not found or avatars are empty
  const initialIndex = initialAvatar && avatars.length > 0 ? Math.max(0, avatars.indexOf(initialAvatar)) : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (avatars.length > 0) {
      // Recalculate index if initialAvatar or avatars array changes
      const validInitialIndex = initialAvatar ? avatars.indexOf(initialAvatar) : -1;
      const startIndex = validInitialIndex !== -1 ? validInitialIndex : 0;
      
      if (currentIndex !== startIndex) { // Only update if truly different
        setCurrentIndex(startIndex);
      }
      // Ensure onAvatarSelect is called with the correct initial avatar,
      // even if the index didn't change but initialAvatar prop might imply an update.
      if (avatars[startIndex]) {
          onAvatarSelect(avatars[startIndex]);
      } else if (avatars.length > 0) {
        // Fallback if startIndex is somehow out of bounds but avatars exist
        onAvatarSelect(avatars[0]); 
        if (currentIndex !== 0) setCurrentIndex(0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAvatar, JSON.stringify(avatars)]); // JSON.stringify for avatars to detect content changes

  const handleNavigation = (newDirectionValue: 1 | -1) => {
    if (avatars.length === 0) return;
    
    // Use the local wrap function. Note: max for wrap is exclusive.
    const nextIndex = wrap(0, avatars.length, currentIndex + newDirectionValue);
    setCurrentIndex(nextIndex);
    onAvatarSelect(avatars[nextIndex]);
  };

  if (!avatars || avatars.length === 0) {
    return <div className="text-center text-muted-foreground">No avatars available.</div>;
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 w-full", className)}>
      <Button
        type="button" // Explicitly set type to button
        variant="outline"
        size="icon"
        aria-label="Previous Avatar"
        onClick={() => handleNavigation(-1)}
        className="shrink-0 bg-background/70 hover:bg-muted border-primary/30"
      >
        <ChevronLeft className="h-6 w-6 text-primary" />
      </Button>

      <div className="relative w-32 h-32 overflow-hidden rounded-md flex items-center justify-center">
        {/* 
          Directly rendering the Slide based on currentIndex.
          The 'key' prop helps React efficiently update/re-render when currentIndex changes.
        */}
        {avatars[currentIndex] && (
          <Slide
            key={currentIndex} // Key ensures React re-renders the Slide when index changes
            avatarPath={avatars[currentIndex]}
            altText={`Avatar ${currentIndex + 1}`}
          />
        )}
      </div>

      <Button
        type="button" // Explicitly set type to button
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
