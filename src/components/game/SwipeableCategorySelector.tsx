
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Send, ArrowLeft, ArrowRight, Bomb, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import Image from "next/image";

const EMOJIS = ["🤔", "🤦", "💡", "💔", "🦸", "🎉", "🔥", "💩", "🚀", "💀", "👽", "🤖"];
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface SwipeableCategorySelectorProps {
  categories: string[];
  onUnleashScenario: (category: string) => void;
  isPending: boolean;
}

export default function SwipeableCategorySelector({
  categories,
  onUnleashScenario,
  isPending,
}: SwipeableCategorySelectorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => (prevIndex + newDirection + categories.length) % categories.length);
  };
  
  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      paginate(-1);
    } else if (info.offset.x < -swipeThreshold) {
      paginate(1);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  const handleUnleash = () => {
    if (selectedCategory) {
      onUnleashScenario(selectedCategory);
    }
  };

  const currentCategoryName = categories[currentIndex];
  const progress = (currentIndex + 1) / categories.length;
  const currentColor = COLORS[currentIndex % COLORS.length];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
    }),
  };

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <Image
        src="/ui/judge selection overlay.png"
        alt="Category selection background with a parchment texture"
        width={1344}
        height={2066}
        className="w-full h-auto"
        data-ai-hint="parchment paper"
        priority
      />
      <div className="absolute top-[23%] left-[10%] right-[10%] h-[68%] flex flex-col justify-between">
        {/* Top Content Area */}
        <div className="flex-shrink-0 space-y-3">
            <div className="flex justify-center items-center gap-2">
              <svg width="30" height="30" viewBox="0 0 100 100" className="-rotate-90">
                  <circle cx="50" cy="50" r="45" stroke="hsl(var(--border))" strokeWidth="10" fill="transparent" />
                  <motion.circle
                      cx="50" cy="50" r="45"
                      stroke={currentColor}
                      strokeWidth="10"
                      fill="transparent"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 45}
                      animate={{ strokeDashoffset: (2 * Math.PI * 45) * (1 - progress) }}
                      transition={{ duration: 0.5 }}
                  />
              </svg>
              <div className="font-semibold text-base text-muted-foreground">
                {currentIndex + 1} / {categories.length}
              </div>
            </div>
            
            <div className="flex justify-center gap-1.5">
              {categories.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentIndex ? 1 : -1);
                    setCurrentIndex(index);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    index === currentIndex ? "bg-primary" : "bg-muted hover:bg-muted-foreground/50"
                  )}
                  style={{ backgroundColor: index === currentIndex ? currentColor : undefined }}
                />
              ))}
            </div>
        </div>

        {/* Carousel Area */}
        <div className="relative h-52 md:h-60 flex items-center justify-center flex-grow">
          <Button onClick={() => paginate(-1)} variant="outline" size="icon" className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-20 rounded-full w-8 h-8 md:w-10 md:h-10">
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute w-full h-full flex items-center justify-center"
            >
              <motion.div
                onClick={() => handleCategorySelect(currentCategoryName)}
                className={cn(
                  "w-10/12 max-w-xs h-full rounded-2xl shadow-lg cursor-pointer transform transition-all duration-300",
                  "flex flex-col items-center justify-center text-center p-4",
                  "border-4 bg-background",
                  selectedCategory === currentCategoryName ? 'scale-105' : 'hover:scale-105'
                )}
                style={{
                  borderColor: selectedCategory === currentCategoryName ? currentColor : 'hsl(var(--border))'
                }}
              >
                <div className="text-4xl md:text-5xl mb-3 md:mb-4">{EMOJIS[currentIndex % EMOJIS.length]}</div>
                <h3 className="text-lg md:text-xl font-bold text-foreground">{currentCategoryName}</h3>
                <p className="text-xs text-muted-foreground mt-2">Tap to select</p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          <Button onClick={() => paginate(1)} variant="outline" size="icon" className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-20 rounded-full w-8 h-8 md:w-10 md:h-10">
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
        
        {/* Bottom Content Area */}
        <div className="flex-shrink-0 space-y-3 pt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mx-4">
                <motion.div className="h-full rounded-full"
                    style={{ backgroundColor: currentColor }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />
            </div>
            <div className="px-4">
              <Button
                onClick={handleUnleash}
                disabled={!selectedCategory || isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3"
              >
                {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Unleash Scenario
              </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
