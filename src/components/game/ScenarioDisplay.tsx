import type { Scenario } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { motion, MotionProps } from 'framer-motion';
import Image from 'next/image';

interface ScenarioDisplayProps extends MotionProps {
  scenario: Scenario | null;
  isBoondoggle?: boolean;
}

export default function ScenarioDisplay({ scenario, isBoondoggle = false, ...motionProps }: ScenarioDisplayProps) {
  if (!scenario) {
    // This state is usually handled by the parent component (PlayerView/JudgeView)
    // But as a fallback if somehow directly rendered with null scenario:
    return (
      <motion.div {...motionProps}>
        <div className="relative shadow-xl border-none rounded-2xl text-center overflow-hidden aspect-[1536/600]">
          <div className="text-center p-6">
            <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
          </div>
        </div>
      </motion.div>
    );
  }

  const cardImage = isBoondoggle ? "/ui/boondoggle-card-v1.png" : "/ui/scenario-card-v2.png";
  const categoryColor = isBoondoggle ? "text-yellow-300" : "text-red-400";
  const aiHint = isBoondoggle ? "boondoggle card" : "scenario card";


  return (
    <motion.div {...motionProps}>
      {/* Set the aspect ratio on the card to match the image, and remove min-height */}
      <div className="relative shadow-xl border-none rounded-2xl text-center overflow-hidden aspect-[1536/600]">
        <Image
          src={cardImage}
          alt="Scenario background"
          fill
          className="object-cover" // object-cover is correct with the right aspect ratio
          priority
          data-ai-hint={aiHint}
        />
        {/* Use flexbox to center the text content vertically and horizontally */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-4">
            <div className="space-y-2">
                <p className={`font-corben text-xl font-bold uppercase tracking-wider ${categoryColor}`}>
                    {scenario.category}
                </p>
                <h2 className="font-im-fell text-3xl md:text-4xl text-white leading-tight">
                    {scenario.text}
                </h2>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
