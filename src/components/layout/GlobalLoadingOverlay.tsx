
"use client";
import { useLoading } from '@/contexts/LoadingContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function GlobalLoadingOverlay() {
  const { isGlobalLoading } = useLoading();
  const [shouldRender, setShouldRender] = useState(false);
  const [opacityClass, setOpacityClass] = useState('opacity-0');

  useEffect(() => {
    let fadeInTimer: NodeJS.Timeout;
    let fadeOutTimer: NodeJS.Timeout;

    if (isGlobalLoading) {
      setShouldRender(true);
      // We need a slight delay to ensure the element is mounted with opacity-0
      // before transitioning to opacity-100, otherwise the fade-in might not be visible.
      fadeInTimer = setTimeout(() => {
        setOpacityClass('opacity-100');
      }, 10); // A small delay like 10ms is often enough
    } else {
      setOpacityClass('opacity-0');
      // Wait for the fade-out transition to complete before unmounting
      fadeOutTimer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // This duration should match the transition duration in className
    }

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [isGlobalLoading]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background
        transition-opacity ease-in-out duration-300
        ${opacityClass}
      `}
    >
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-xl text-primary font-semibold">Loading the terribleness...</p>
    </div>
  );
}
