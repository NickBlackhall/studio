
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { DialogClose } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from '@/lib/utils';

interface MorphingDialogWrapperProps {
  children: React.ReactNode;
  className?: string;
  backgroundImage?: string;
  backgroundOverlay?: string;
  icon?: string;
  title?: string;
  variant?: 'default' | 'winner' | 'scoreboard' | 'settings' | 'gameOver';
}

const MorphingDialogWrapper: React.FC<MorphingDialogWrapperProps> = ({
  children,
  className = '',
  backgroundImage,
  backgroundOverlay = 'rgba(0,0,0,0.7)',
  icon,
  title,
  variant = 'default'
}) => {
  const variantStyles = {
    default: 'bg-gradient-to-br from-purple-600 to-purple-700',
    winner: 'bg-gradient-to-br from-green-500 to-green-600',
    scoreboard: 'bg-gradient-to-br from-red-500 to-red-600', 
    settings: 'bg-gradient-to-br from-purple-600 to-purple-700',
    gameOver: 'bg-gradient-to-br from-gray-800 to-gray-900'
  };

  const backgroundStyle = backgroundImage ? {
    backgroundImage: `linear-gradient(${backgroundOverlay}, ${backgroundOverlay}), url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  } : {};

  return (
    <motion.div
      initial={{ 
        clipPath: 'circle(0% at 50% 50%)',
        scale: 0.5,
        rotate: 10
      }}
      animate={{ 
        clipPath: 'circle(100% at 50% 50%)',
        scale: 1,
        rotate: 0
      }}
      exit={{ 
        clipPath: 'circle(0% at 50% 50%)',
        scale: 0.5,
        rotate: -10
      }}
      transition={{
        duration: 0.6,
        ease: [0.175, 0.885, 0.32, 1.275]
      }}
      className={cn(
        `w-full h-full p-8 text-center text-white relative z-10 rounded-lg`,
        !backgroundImage && variantStyles[variant],
        className
      )}
      style={backgroundStyle}
    >
      {icon && (
        <motion.div 
          className="text-6xl mb-4"
          animate={{ 
            y: [0, -10, 0] 
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {icon}
        </motion.div>
      )}
      
      {title && (
        <motion.h2 
          className="text-2xl font-bold mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {title}
        </motion.h2>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {children}
      </motion.div>

       <DialogClose className="absolute right-4 top-4 z-20 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none bg-white/10 hover:bg-white/20">
        <X className="h-5 w-5 text-white" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </motion.div>
  );
};

export { MorphingDialogWrapper };
