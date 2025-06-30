
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogPortal } from "@radix-ui/react-dialog";
import { X } from 'lucide-react';

interface PureMorphingModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'winner' | 'scoreboard' | 'settings' | 'gameOver' | 'image';
  icon?: string;
  title?: string;
  backgroundImage?: string;
  className?: string;
  isDismissable?: boolean;
}

const PureMorphingModal: React.FC<PureMorphingModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  variant = 'default',
  icon,
  title,
  backgroundImage,
  className = '',
  isDismissable = true,
}) => {
  const variantStyles = {
    default: 'bg-gradient-to-br from-purple-600 to-purple-700',
    winner: 'bg-gradient-to-br from-green-500 to-green-600',
    scoreboard: 'bg-gradient-to-br from-red-500 to-red-600', 
    settings: 'bg-gradient-to-br from-purple-600 to-purple-700',
    gameOver: 'bg-gradient-to-br from-gray-800 to-gray-900',
    image: 'bg-transparent',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && isDismissable) onClose(); }}>
      <AnimatePresence>
        {isOpen && (
          <DialogPortal>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={isDismissable ? onClose : undefined}
            />
            
            {/* Modal Container - Perfectly Centered */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ 
                  clipPath: 'circle(0% at 50% 50%)',
                }}
                animate={{ 
                  clipPath: 'circle(100% at 50% 50%)',
                }}
                exit={{ 
                  clipPath: 'circle(0% at 50% 50%)',
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.175, 0.885, 0.32, 1.275]
                }}
                className={`
                  w-full max-w-md h-auto p-8 text-center text-white 
                  rounded-lg overflow-hidden relative
                  ${variantStyles[variant]}
                  ${className}
                `}
                style={{
                  backgroundImage: backgroundImage ? 
                    `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${backgroundImage})` : 
                    undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                {isDismissable && (
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 rounded-full p-1 opacity-70 
                              transition-opacity hover:opacity-100 bg-white/10 hover:bg-white/20"
                  >
                    <X className="h-5 w-5 text-white" />
                  </button>
                )}

                {/* Icon */}
                {icon && (
                  <motion.div 
                    className="text-6xl mb-4"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: 1,
                      scale: 1,
                      y: [0, -10, 0] 
                    }}
                    transition={{ 
                      opacity: { delay: 0.4, duration: 0.3 },
                      scale: { delay: 0.4, duration: 0.3 },
                      y: { delay: 0.8, duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    {icon}
                  </motion.div>
                )}
                
                {/* Title */}
                {title && (
                  <motion.h2 
                    className="text-2xl font-bold mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                  >
                    {title}
                  </motion.h2>
                )}
                
                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  {children}
                </motion.div>
              </motion.div>
            </div>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export { PureMorphingModal };
