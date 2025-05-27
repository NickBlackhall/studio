import type { Scenario } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface ScenarioDisplayProps {
  scenario: Scenario | null;
}

export default function ScenarioDisplay({ scenario }: ScenarioDisplayProps) {
  if (!scenario) {
    return (
      <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-muted-foreground">Waiting for Scenario...</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground">The judge is picking a category. Get ready!</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}
