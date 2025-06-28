
"use client";

import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import Image from "next/image";

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
    // These keys must EXACTLY match the category names from the database,
    // including any typos, extra spaces, or ampersands.
    const categoryImageMap: { [key: string]: string } = {
        " R-Rated": "/ui/rated-r-panel.png",
        "Absurd & Surreal": "/ui/absurd-and-surreal-panel.png",
        "Life things": "/ui/Life-things-panel.png",
        "Pop Culture & Internet ": "/ui/pop-culture-panel.png",
        "Super Powers": "/ui/Super-Powers-panel.png",
    };

    return categories.map((name) => {
      const imagePath = categoryImageMap[name];
      // Use fallback if image path is not found for a category
      const finalImagePath = imagePath || "/ui/Super-Powers-panel.png";
      if (!imagePath) {
        console.warn(`CategorySelector: No image map found for category: "${name}". Using Super Powers as fallback.`);
      }
      return { name, imagePath: finalImagePath };
    });
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

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "80%" : "-80%",
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "80%" : "-80%",
      opacity: 0,
    }),
  };

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* Layer 1: Swipeable Category Images (Bottom) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="absolute top-[28.4%] left-1/2 -translate-x-1/2 w-[59%] h-[40%]">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
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
                key={currentCategory.imagePath}
                src={currentCategory.imagePath}
                alt={currentCategory.name}
                fill
                priority
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover rounded-xl shadow-lg"
                data-ai-hint={currentCategory.name}
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
          sizes="100vw"
          data-ai-hint="selection frame"
        />
      </div>

      {/* Layer 3: UI Controls (Top) */}
      <div className="absolute inset-0 z-30 pointer-events-auto">
        {/* Carousel Navigation Arrows */}
        <div className="absolute top-1/2 -translate-y-[10%] w-full flex justify-between px-[6%]">
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
        <div className="absolute bottom-[8%] left-[10%] right-[10%] flex flex-col items-center gap-4">
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
