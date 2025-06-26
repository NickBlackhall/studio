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
      <Card className="relative shadow-xl border-none rounded-2xl text-center min-h-[180px] flex flex-col justify-center overflow-hidden">
        <Image
          src="/ui/scenario-card-v2.png"
          alt="Scenario background"
          fill
          className="object-cover"
          priority
        />
        <div className="relative z-10 flex h-full flex-col justify-center bg-black/20 p-4">
            <CardHeader className="pt-2 pb-2">
              <CardDescription className="text-lg font-semibold uppercase tracking-wider text-red-300 drop-shadow-md">
                  {scenario.category}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <CardTitle className="text-2xl md:text-3xl font-bold text-white leading-tight drop-shadow-lg">
                  {scenario.text}
              </CardTitle>
            </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
