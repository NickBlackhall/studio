
"use client";

import { useState, useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '../ui/card';

const EMOJIS = ["🤔", "🤦", "💡", "💔", "🦸", "🎉", "🔥", "💩", "🚀", "💀"];

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { scrollXProgress } = useScroll({ container: scrollRef });
  const scaleX = useSpring(scrollXProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };
  
  const handleUnleash = () => {
    if (selectedCategory) {
      onUnleashScenario(selectedCategory);
    }
  };

  return (
    <Card className="w-full space-y-4 p-4 border-2 border-muted rounded-xl shadow-lg">
      <h2 className="text-2xl font-semibold text-center text-primary">Select a Category</h2>
      {/* Scrollable container */}
      <div className="relative">
        <div 
          ref={scrollRef}
          className="flex overflow-x-auto space-x-4 p-4 scrollbar-hide"
        >
          {categories.map((category, index) => (
            <motion.div
              key={category}
              onClick={() => handleSelectCategory(category)}
              className={cn(
                "flex-shrink-0 w-48 h-64 rounded-lg shadow-lg cursor-pointer transform transition-transform duration-300",
                "flex flex-col items-center justify-center text-center p-4",
                "border-4",
                selectedCategory === category
                  ? 'border-accent scale-105 bg-accent/20'
                  : 'border-primary bg-background hover:scale-105'
              )}
              whileHover={{ y: -5 }}
            >
              <span className="text-5xl mb-4">{EMOJIS[index % EMOJIS.length]}</span>
              <h3 className="text-xl font-bold text-foreground">{category}</h3>
            </motion.div>
          ))}
        </div>
        {/* Masking gradients */}
        <div className="absolute top-0 left-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
      </div>
      
      {/* Progress Bar */}
       <div className="px-4">
         <div className="h-2 bg-muted rounded-full">
            <motion.div className="h-2 bg-accent rounded-full" style={{ scaleX }} />
         </div>
       </div>

      {/* Unleash Button */}
      <div className="px-4 pt-2">
        <Button
          onClick={handleUnleash}
          disabled={!selectedCategory || isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3"
        >
          {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          Unleash Scenario
        </Button>
      </div>
    </Card>
  );
}
