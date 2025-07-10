
"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from 'lucide-react';
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

  const enhancedCategories = useMemo(() => {
    const categoryImageMap: { [key: string]: string } = {
        " R-Rated": "/ui/rated-r-panel.png",
        "Absurd & Surreal": "/ui/absurd-and-surreal-panel.png",
        "Life things": "/ui/Life-things-panel.png",
        "Pop Culture & Internet ": "/ui/pop-culture-panel.png",
        "Super Powers": "/ui/Super-Powers-panel.png",
    };

    return categories.map((name) => {
      const imagePath = categoryImageMap[name];
      const finalImagePath = imagePath || "/ui/Super-Powers-panel.png"; // Fallback
      return { name, imagePath: finalImagePath };
    });
  }, [categories]);
  
  const selectedCategory = enhancedCategories[currentIndex]?.name;

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => (prevIndex + newDirection + enhancedCategories.length) % enhancedCategories.length);
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
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "80%" : "-80%",
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div className="w-[95%] mx-auto relative">
      {/* Layer 1: Swipeable Category Images (Bottom) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="absolute top-[28.4%] left-1/2 -translate-x-1/2 w-[59%] h-[40%]">
          <AnimatePresence initial={false} custom={direction}>
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
                sizes="(max-width: 768px) 80vw, 50vw"
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
          width={1028}
          height={1580}
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
          <button
            onClick={() => paginate(-1)}
            type="button"
            className="bg-transparent border-none p-0 transition-transform hover:scale-105 active:scale-95"
            aria-label="Previous Category"
          >
            <Image
              src="/ui/category-select-left-button.png"
              alt="Previous Category"
              width={56}
              height={56}
              className="object-contain"
              data-ai-hint="previous button"
            />
          </button>
          <button
            onClick={() => paginate(1)}
            type="button"
            className="bg-transparent border-none p-0 transition-transform hover:scale-105 active:scale-95"
            aria-label="Next Category"
          >
            <Image
              src="/ui/category-select-right-button.png"
              alt="Next Category"
              width={56}
              height={56}
              className="object-contain"
              data-ai-hint="next button"
            />
          </button>
        </div>
        
        {/* Bottom Content Area */}
        <div className="absolute bottom-[8%] left-[10%] right-[10%] flex flex-col items-center gap-4">
          <button
            onClick={handleUnleash}
            disabled={!selectedCategory || isPending}
            className="group animate-slow-scale-pulse disabled:animate-none disabled:opacity-70"
          >
            {isPending ? (
              <div className="h-[81px] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
              </div>
            ) : (
              <Image
                src="/ui/unleash-scenario-button.png"
                alt="Unleash Scenario"
                width={214}
                height={81}
                className="object-contain drop-shadow-xl"
                data-ai-hint="unleash button"
                sizes="50vw"
                priority
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
