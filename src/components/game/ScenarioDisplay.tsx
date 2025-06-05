
import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2 } from 'lucide-react';
import { motion, MotionProps } from 'framer-motion';

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
      <Card className="shadow-xl border-2 border-primary rounded-xl bg-primary text-primary-foreground">
        <CardHeader className="p-6">
          <CardDescription className="text-sm uppercase tracking-wider text-primary-foreground/80 mb-1">
            Category: {scenario.category}
          </CardDescription>
          <CardTitle className="text-3xl font-bold flex items-start">
            <Lightbulb className="mr-3 mt-1 h-8 w-8 text-accent flex-shrink-0" />
            <span>{scenario.text}</span>
          </CardTitle>
        </CardHeader>
      </Card>
    </motion.div>
  );
}
