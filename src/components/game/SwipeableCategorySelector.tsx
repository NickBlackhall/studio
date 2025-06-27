
"use client";

import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
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

  const enhancedCategories = useMemo(() => {
    return categories.map((name, index) => ({
      name,
      emoji: EMOJIS[index % EMOJIS.length],
      color: COLORS[index % COLORS.length],
      imagePath: `https://placehold.co/1024x1024.png?text=${encodeURIComponent(EMOJIS[index % EMOJIS.length])}`,
    }));
  }, [categories]);

  useEffect(() => {
    if (enhancedCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(enhancedCategories[0].name);
    }
  }, [enhancedCategories, selectedCategory]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    const newIndex = (currentIndex + newDirection + enhancedCategories.length) % enhancedCategories.length;
    setCurrentIndex(newIndex);
    setSelectedCategory(enhancedCategories[newIndex].name);
  };
  
  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      paginate(-1);
    } else if (info.offset.x < -swipeThreshold) {
      paginate(1);
    }
  };

  const handleUnleash = () => {
    if (selectedCategory) {
      onUnleashScenario(selectedCategory);
    }
  };

  if (enhancedCategories.length === 0) {
    return <div>Loading categories...</div>;
  }
  
  const currentCategory = enhancedCategories[currentIndex];
  const progress = (currentIndex + 1) / enhancedCategories.length;

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
      {/* Layer 1: Swipeable Category Images (Bottom) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[50%] h-[35%]">
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
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <Image
                src={currentCategory.imagePath}
                alt={currentCategory.name}
                fill
                className="object-cover rounded-xl shadow-lg"
                data-ai-hint={currentCategory.name}
                priority={true}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Layer 2: The Frame Graphic (Middle) */}
      <div className="relative z-20 pointer-events-none">
        <Image
          src="/ui/judge selection overlay.png"
          alt="Category selection frame"
          width={1344}
          height={2066}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Layer 3: UI Controls (Top) */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {/* Top Content Area */}
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-full flex flex-col items-center gap-2 pointer-events-auto">
          <div className="font-semibold text-xl text-black/80">
            {currentIndex + 1} / {enhancedCategories.length}
          </div>
          <div className="h-2 bg-black/20 rounded-full overflow-hidden w-1/3">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: currentCategory.color }}
              initial={{ width: '0%' }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="absolute top-1/2 -translate-y-[10%] w-full flex justify-between px-[6%] pointer-events-auto">
          <Button 
            onClick={() => paginate(-1)} 
            variant="ghost" 
            size="icon" 
            className="rounded-full w-14 h-14 bg-white/80 hover:bg-white/90 shadow-lg"
          >
            <ArrowLeft className="h-6 w-6 text-black" />
          </Button>
          <Button 
            onClick={() => paginate(1)} 
            variant="ghost" 
            size="icon" 
            className="rounded-full w-14 h-14 bg-white/80 hover:bg-white/90 shadow-lg"
          >
            <ArrowRight className="h-6 w-6 text-black" />
          </Button>
        </div>
        
        {/* Bottom Content Area */}
        <div className="absolute bottom-[8%] left-[10%] right-[10%] flex flex-col items-center gap-4 pointer-events-auto">
          <h2 className="font-im-fell text-4xl text-black text-center leading-tight">
            {currentCategory.name}
          </h2>
          <div className="flex justify-center gap-2">
            {enhancedCategories.map((cat, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                  setSelectedCategory(cat.name);
                }}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-200",
                  index === currentIndex 
                    ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-transparent" 
                    : "bg-black/30 hover:bg-black/50"
                )}
                style={{ 
                  backgroundColor: index === currentIndex ? cat.color : undefined 
                }}
              />
            ))}
          </div>
          <Button
            onClick={handleUnleash}
            disabled={!selectedCategory || isPending}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xl font-bold py-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            {isPending ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Send className="mr-3 h-6 w-6" />}
            Unleash Scenario
          </Button>
        </div>
      </div>
    </div>
  );
}
