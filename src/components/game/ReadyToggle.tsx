
"use client";

import Image from 'next/image';
import { cn } from "@/lib/utils";

interface ReadyToggleProps {
  isReady: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function ReadyToggle({ isReady, onToggle, disabled = false }: ReadyToggleProps) {
  return (
    <button
      type="button"
      onClick={!disabled ? onToggle : undefined}
      disabled={disabled}
      className={cn(
        "relative h-8 w-14 cursor-pointer transition-opacity duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      role="switch"
      aria-checked={isReady}
      aria-label={isReady ? "Ready status: On" : "Ready status: Off"}
    >
      <span className="sr-only">{isReady ? "Status: Ready" : "Status: Not Ready"}</span>
      <Image
        src={isReady ? "/ui/toggle-on.png" : "/ui/toggle-off.png"}
        alt={isReady ? "Ready toggle is on" : "Ready toggle is off"}
        width={56}
        height={32}
        className="object-contain"
        data-ai-hint="toggle on off"
      />
    </button>
  );
}
