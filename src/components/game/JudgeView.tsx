
"use client";

import type { GameState, Player, Scenario, Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useTransition, useMemo } from 'react';
import { Gavel, Send, CheckCircle, Loader2, ListChecks, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';

interface JudgeViewProps {
  gameState: GameState;
  judge: Player;
  onSelectCategory: (categoryId: string) => Promise<void>;
  onSelectWinner: (cardText: string) => Promise<void>;
}

export default function JudgeView({ gameState, judge, onSelectCategory, onSelectWinner }: JudgeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedWinningCard, setSelectedWinningCard] = useState<string>('');
  const [isPendingCategory, startTransitionCategory] = useTransition();
  const [isPendingWinner, startTransitionWinner] = useTransition();
  const { toast } = useToast();

  const handleCategorySubmit = () => {
    if (!selectedCategory) {
      toast({ title: "Hold up!", description: "Please select a category first.", variant: "destructive" });
      return;
    }
    startTransitionCategory(async () => {
      await onSelectCategory(selectedCategory);
      toast({ title: "Category Selected!", description: `Scenario from "${selectedCategory}" is up!` });
    });
  };

  const handleWinnerSubmit = () => {
    if (!selectedWinningCard) {
      toast({ title: "Wait a sec!", description: "You need to pick a winning card.", variant: "destructive" });
      return;
    }
    startTransitionWinner(async () => {
      await onSelectWinner(selectedWinningCard);
      // Toast for winner announcement will be handled on the main game page or WinnerDisplay component
    });
  };

  // Shuffle submissions for anonymous judging, memoize to prevent re-shuffling on every render
  const shuffledSubmissions = useMemo(() => {
    return gameState.submissions.slice().sort(() => Math.random() - 0.5);
  }, [gameState.submissions]);

  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-2 border-accent rounded-xl">
        <CardHeader className="bg-accent text-accent-foreground p-6">
          <CardTitle className="text-3xl font-bold flex items-center"><Gavel className="mr-3 h-8 w-8" /> You are the Judge!</CardTitle>
          <CardDescription className="text-accent-foreground/80 text-base">Wield your power with terrible responsibility.</CardDescription>
        </CardHeader>
      </Card>

      {gameState.gamePhase === 'category_selection' && (
        <Card className="shadow-lg border-2 border-muted rounded-xl">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" /> Select a Category</CardTitle>
            <CardDescription>Choose the arena for this round's terrible choices.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full text-lg py-3 border-2 focus:border-primary">
                <SelectValue placeholder="Pick a category of terribleness..." />
              </SelectTrigger>
              <SelectContent>
                {gameState.categories.map((category) => (
                  <SelectItem key={category} value={category} className="text-lg">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCategorySubmit} disabled={isPendingCategory || !selectedCategory} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3">
              {isPendingCategory ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              Unleash Scenario
            </Button>
          </CardContent>
        </Card>
      )}

      {gameState.gamePhase === 'player_submission' && gameState.currentScenario && (
        <>
          <ScenarioDisplay scenario={gameState.currentScenario} />
          <Card className="text-center shadow-lg border-2 border-muted rounded-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-foreground">Players are Submitting...</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
              <p className="text-muted-foreground mt-4">Waiting for those terrible, terrible answers...</p>
            </CardContent>
          </Card>
        </>
      )}

      {gameState.gamePhase === 'judging' && gameState.currentScenario && (
        <>
          <ScenarioDisplay scenario={gameState.currentScenario} />
          <Card className="shadow-lg border-2 border-secondary rounded-xl">
            <CardHeader className="bg-secondary text-secondary-foreground p-6">
              <CardTitle className="text-2xl font-semibold flex items-center"><Crown className="mr-2 h-6 w-6" /> Judge the Submissions</CardTitle>
              <CardDescription className="text-secondary-foreground/80">Choose the response that is truly the most terrible (or funniest).</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {shuffledSubmissions.length > 0 ? (
                shuffledSubmissions.map((submission) => ( // Use submission.playerId as key
                  <Button
                    key={submission.playerId} // Changed key from index to submission.playerId
                    variant={selectedWinningCard === submission.cardText ? "default" : "outline"}
                    onClick={() => setSelectedWinningCard(submission.cardText)}
                    className={`w-full h-auto p-4 text-left text-lg whitespace-normal justify-start
                                ${selectedWinningCard === submission.cardText ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent' : 'border-muted hover:bg-muted/50 hover:border-foreground'}`}
                  >
                    {submission.cardText}
                  </Button>
                ))
              ) : (
                <p className="text-muted-foreground text-center">No submissions yet, or something went wrong!</p>
              )}
              <Button onClick={handleWinnerSubmit} disabled={isPendingWinner || !selectedWinningCard || shuffledSubmissions.length === 0} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg font-semibold py-3 mt-4">
                {isPendingWinner ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                Crown the Winner!
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
