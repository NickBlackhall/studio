import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-muted-foreground">Loading Scenario...</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...motionProps}>
      <div className="relative w-full aspect-[1536/600]">
        <Image
          src="/ui/scenario-card-v2.png"
          alt="Scenario Card"
          fill
          className="object-cover"
          data-ai-hint="scenario card"
          priority
        />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-8 md:p-12">
            <p className="font-corben text-base md:text-lg text-black/80 uppercase tracking-wider mb-1 md:mb-2">
                {scenario.category}
            </p>
            <h2 className="font-im-fell text-2xl md:text-3xl text-black leading-tight max-w-prose">
                {scenario.text}
            </h2>
        </div>
      </div>
    </motion.div>
  );
}
