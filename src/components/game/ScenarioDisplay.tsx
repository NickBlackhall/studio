import type { Scenario } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { motion, MotionProps } from 'framer-motion';
import Image from 'next/image';

interface ScenarioDisplayProps extends MotionProps {
  scenario: Scenario | null;
}

export default function ScenarioDisplay({ scenario, ...motionProps }: ScenarioDisplayProps) {
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

  return (
    <motion.div {...motionProps}>
      {/* Set the aspect ratio on the card to match the image, and remove min-height */}
      <div className="relative shadow-xl border-none rounded-2xl text-center overflow-hidden aspect-[1536/600]">
        <Image
          src="/ui/scenario-card-v2.png"
          alt="Scenario background"
          fill
          className="object-cover" // object-cover is correct with the right aspect ratio
          priority
          data-ai-hint="scenario card"
        />
        {/* Use flexbox to center the text content vertically and horizontally */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-4">
            <div className="space-y-2">
                <p className="text-lg font-semibold uppercase tracking-wider text-red-400">
                    {scenario.category}
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                    {scenario.text}
                </h2>
            </div>
        </div>
      </div>
    </motion.div>
  );
}
