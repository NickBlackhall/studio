
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
    stiffness: 700, // Increased stiffness
    damping: 30,
  };

  return (
    <div
      onClick={!disabled ? onToggle : undefined}
      className={cn(
        "flex items-center h-8 w-14 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out", // Adjusted size and padding
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isReady ? "bg-green-500 justify-end" : "bg-muted justify-start border border-input", // Added border for off-state
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
        className="h-6 w-6 bg-white rounded-full shadow-md" // Adjusted to fixed size
        layout
        transition={spring}
      />
    </div>
  );
}
