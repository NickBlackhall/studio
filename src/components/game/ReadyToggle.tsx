
"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ReadyToggleProps {
  isReady: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function ReadyToggle({ isReady, onToggle, disabled = false }: ReadyToggleProps) {
  const spring = {
    type: "spring",
    stiffness: 600, // Adjusted for a slightly snappier feel
    damping: 30,
  };

  return (
    <div
      onClick={!disabled ? onToggle : undefined}
      className={cn(
        "flex items-center h-10 w-20 rounded-full p-[5px] cursor-pointer transition-colors duration-300 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", // Consistent focus ring
        isReady ? "bg-green-500 justify-end" : "bg-muted justify-start",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      role="switch"
      aria-checked={isReady}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          onToggle();
          e.preventDefault();
        }
      }}
    >
      <span className="sr-only">{isReady ? "Status: Ready" : "Status: Not Ready"}</span>
      <motion.div
        className="h-[calc(100%-2px)] w-[calc(100%-2px)] aspect-square bg-white rounded-full shadow-md" // Handle size relative to container
        layout
        transition={spring}
      />
    </div>
  );
}
