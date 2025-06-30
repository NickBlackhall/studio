
'use client';

import * as React from 'react';
import { DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const modalVariants = cva(
  'relative w-full max-w-lg overflow-hidden shadow-2xl p-0 border-none', // Base styles
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-br from-slate-800 to-slate-900 text-white',
        winner: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white',
        scoreboard: 'bg-gradient-to-br from-red-600 via-red-800 to-black text-white',
        settings: 'bg-gradient-to-br from-purple-600 to-indigo-800 text-white',
        gameOver: 'bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface MorphingDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogContent>,
    VariantProps<typeof modalVariants> {
  icon?: string;
  title: string;
  backgroundImage?: string;
  backgroundOverlay?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
}

const MorphingDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  MorphingDialogContentProps
>(
  ({ className, children, variant, icon, title, backgroundImage, backgroundOverlay, backgroundSize, backgroundPosition, ...props }, ref) => {
    
    const backgroundStyle: React.CSSProperties = backgroundImage
      ? {
          backgroundImage: `linear-gradient(${backgroundOverlay || 'rgba(0,0,0,0.5)'}, ${backgroundOverlay || 'rgba(0,0,0,0.5)'}), url(${backgroundImage})`,
          backgroundSize: backgroundSize || 'cover',
          backgroundPosition: backgroundPosition || 'center',
        }
      : {};

    const dropIn = {
      hidden: {
        y: "-50vh",
        opacity: 0,
        borderRadius: "100%",
        scale: 0.3
      },
      visible: {
        y: "0",
        opacity: 1,
        borderRadius: "1rem",
        scale: 1,
        transition: {
          duration: 0.4,
          type: "spring",
          damping: 25,
          stiffness: 300,
        },
      },
      exit: {
        y: "50vh",
        opacity: 0,
        borderRadius: "100%",
        scale: 0.3,
        transition: {
          duration: 0.3
        }
      },
    };

    return (
        <DialogContent
            ref={ref}
            asChild
            className="bg-transparent border-none shadow-none p-0 max-w-lg"
            {...props}
        >
            <motion.div
              variants={dropIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={backgroundStyle}
              className={cn(modalVariants({ variant }), className)}
            >
                <div className="relative z-10 p-6 sm:p-8 flex flex-col h-full max-h-[85vh]">
                    <div className="flex-shrink-0 flex items-center gap-4 mb-4">
                        {icon && <div className="text-4xl select-none">{icon}</div>}
                        <DialogTitle className="text-3xl font-bold">
                            {title}
                        </DialogTitle>
                    </div>
                    <div className="flex-grow overflow-y-auto -mr-6 pr-6 scrollbar-hide">
                        {children}
                    </div>
                </div>
                 <DialogClose className="absolute right-4 top-4 z-20 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none bg-white/10 hover:bg-white/20">
                    <X className="h-5 w-5 text-white" />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </motion.div>
        </DialogContent>
    );
  }
);
MorphingDialogContent.displayName = 'MorphingDialogContent';

export { MorphingDialogContent };
