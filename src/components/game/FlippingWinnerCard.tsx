"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { PlayerClientState } from '@/lib/types';

interface FlippingWinnerCardProps {
  isFlipped: boolean;
  winner: PlayerClientState;
  cardText: string;
}

export default function FlippingWinnerCard({ isFlipped, winner, cardText }: FlippingWinnerCardProps) {
  const rotationY = isFlipped ? 180 : 0;
  
  const Face = ({ className, children, ...props }: { className?: string, children: React.ReactNode }) => (
    <div
      className={`absolute w-full h-full [backface-visibility:hidden] rounded-2xl overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );

  return (
    // Set the aspect ratio and perspective for the 3D effect
    <div className="w-full aspect-[1024/1536]" style={{ perspective: '1200px' }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: rotationY }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      >
        {/* Face 1: The "Round Winner" banner */}
        <Face className="bg-black">
          <Image
            src="/backgrounds/round-winner-poster.png"
            alt="Round Winner"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            data-ai-hint="winner banner"
          />
        </Face>
        
        {/* Face 2: The winner details */}
        <Face className="bg-black" style={{ transform: 'rotateY(180deg)' }}>
          <Image
            src="/backgrounds/winner-details-poster.png"
            alt="Winner Details"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            data-ai-hint="winner details poster"
          />
          <div className="absolute inset-0">
            {/* Avatar positioned within its area */}
            <div className="absolute top-[14%] left-1/2 -translate-x-1/2 w-[48%]">
              <Avatar className="w-full h-auto aspect-square rounded-md">
                <AvatarImage src={winner.avatar} alt={winner.name} />
                <AvatarFallback>{winner.name?.substring(0, 2).toUpperCase() || 'P'}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Player Name positioned within its area */}
            <div className="absolute top-[46%] left-1/2 -translate-x-1/2 w-[80%] text-center">
              <p 
                className="font-im-fell text-black font-bold leading-none drop-shadow"
                // Responsive font size using clamp
                style={{ fontSize: 'clamp(1.5rem, 8vw, 2.5rem)' }}
              >
                {winner.name}
              </p>
            </div>
            
            {/* Response Card positioned at the bottom */}
            <div className="absolute bottom-[13.5%] left-1/2 -translate-x-1/2 w-[88%] aspect-[1536/600]">
              <Image
                src="/ui/mit-card-front.png"
                alt="Winning response card"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 80vw, 30vw"
                data-ai-hint="card front"
              />
              <div className="absolute inset-0 flex items-center justify-center p-[8%]">
                <p 
                  className="font-im-fell text-black text-center leading-tight"
                  style={{ fontSize: 'clamp(0.75rem, 3.5vw, 1.25rem)' }}
                >
                  {cardText}
                </p>
              </div>
            </div>
          </div>
        </Face>
      </motion.div>
    </div>
  );
}
