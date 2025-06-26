import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
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
      <Card className="shadow-xl border-4 border-primary rounded-2xl bg-gradient-to-br from-card to-muted/30 text-center min-h-[180px] flex flex-col justify-center">
        <CardHeader className="pt-6 pb-2">
          <CardDescription className="text-lg font-semibold uppercase tracking-wider text-secondary">
            {scenario.category}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {scenario.text}
          </CardTitle>
        </CardContent>
      </Card>
    </motion.div>
  );
}
