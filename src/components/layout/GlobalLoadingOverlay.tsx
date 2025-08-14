
"use client";
import { useLoading } from '@/contexts/LoadingContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function GlobalLoadingOverlay() {
  const { isGlobalLoading } = useLoading();
  const [shouldRender, setShouldRender] = useState(false);
  const [opacityClass, setOpacityClass] = useState('opacity-0');

  const FADE_DURATION_MS = 800; // Define duration in ms - extended to coordinate with content fade-in

  useEffect(() => {
    let fadeOutTimer: NodeJS.Timeout;

    if (isGlobalLoading) {
      setShouldRender(true);
      // Immediate visibility to prevent content flash
      setOpacityClass('opacity-100');
    } else {
      setOpacityClass('opacity-0');
      // Wait for the fade-out transition to complete before unmounting
      fadeOutTimer = setTimeout(() => {
        setShouldRender(false);
      }, FADE_DURATION_MS); // Match CSS duration
    }

    return () => {
      clearTimeout(fadeOutTimer);
    };
  }, [isGlobalLoading]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm
        transition-opacity ease-in-out
        ${opacityClass}
      `}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }} // Apply duration via style
    >
      <Loader2 className="h-16 w-16 animate-spin text-primary-foreground mb-4" />
      <p className="text-xl text-primary-foreground font-semibold">Loading the terribleness...</p>
    </div>
  );
}
