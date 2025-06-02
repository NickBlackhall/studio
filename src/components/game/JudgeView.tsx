
"use client";

import type { GameClientState, PlayerClientState } from '@/lib/types'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useTransition, useMemo, useEffect } from 'react';
import { Gavel, Send, CheckCircle, Loader2, ListChecks, Crown, PlusCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { cn } from '@/lib/utils';
import { handleJudgeApprovalForCustomCard } from '@/app/game/actions';


interface JudgeViewProps {
  gameState: GameClientState; 
  judge: PlayerClientState;    
  onSelectCategory: (category: string) => Promise<void>; 
  onSelectWinner: (cardText: string) => Promise<void>;
}

export default function JudgeView({ gameState, judge, onSelectCategory, onSelectWinner }: JudgeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedWinningCard, setSelectedWinningCard] = useState<string>('');
  const [isPendingCategory, startTransitionCategory] = useTransition();
  const [isPendingWinner, startTransitionWinner] = useTransition();
  const [isPendingApproval, startTransitionApproval] = useTransition();
  const { toast } = useToast();

  // Manage modal visibility based on game phase
  const showApprovalModal = gameState.gamePhase === 'judge_approval_pending' && gameState.currentJudgeId === judge.id;

  useEffect(() => {
    if (gameState.categories.length > 0 && !selectedCategory) {
      // setSelectedCategory(gameState.categories[0]); 
    }
     // Reset selections if phase changes away from judging or category selection
    if (gameState.gamePhase !== 'judging') {
        setSelectedWinningCard('');
    }
    if (gameState.gamePhase !== 'category_selection') {
        setSelectedCategory('');
    }
  }, [gameState.categories, selectedCategory, gameState.gamePhase]);

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
      // Toast for selection will be handled by the outcome (approval modal or direct announcement)
    });
  };

  const handleApprovalDecision = (addToDeck: boolean) => {
    if (!gameState.gameId) return;
    startTransitionApproval(async () => {
      try {
        await handleJudgeApprovalForCustomCard(gameState.gameId, addToDeck);
        toast({ title: "Decision Made!", description: addToDeck ? "Card added to deck!" : "Card was for this round only."});
      } catch (error: any) {
        toast({ title: "Approval Error", description: error.message || "Could not process approval.", variant: "destructive"});
      }
    });
  };

  const shuffledSubmissions = useMemo(() => {
    if (!gameState.submissions) return [];
    return gameState.submissions.slice().sort(() => Math.random() - 0.5);
  }, [gameState.submissions]);

  const isUnleashScenarioButtonActive = !isPendingCategory && !!selectedCategory && gameState.categories.length > 0;
  const isCrownWinnerButtonActive = !isPendingWinner && !!selectedWinningCard && shuffledSubmissions.length > 0;

  const lastRoundWinnerForModal = gameState.lastWinner?.player;
  const lastRoundCardTextForModal = gameState.lastWinner?.cardText;


  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-2 border-accent rounded-xl">
        <CardHeader className="bg-accent text-accent-foreground p-6">
          <CardTitle className="text-3xl font-bold flex items-center"><Gavel className="mr-3 h-8 w-8" /> You are the Judge!</CardTitle>
          <CardDescription className="text-accent-foreground/80 text-base">Wield your power with terrible responsibility, {judge.name}.</CardDescription>
        </CardHeader>
      </Card>

      {gameState.gamePhase === 'category_selection' && (
        <Card className="shadow-lg border-2 border-muted rounded-xl">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" /> Select a Category</CardTitle>
            <CardDescription>Choose the arena for this round's terrible choices.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={gameState.categories.length === 0}>
              <SelectTrigger className="w-full text-lg py-3 border-2 focus:border-primary">
                <SelectValue placeholder={gameState.categories.length > 0 ? "Pick a category of terribleness..." : "Loading categories..."} />
              </SelectTrigger>
              <SelectContent>
                {gameState.categories.map((category) => (
                  <SelectItem key={category} value={category} className="text-lg">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleCategorySubmit} 
              disabled={!isUnleashScenarioButtonActive} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-semibold py-3"
            >
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
              <p className="text-sm text-muted-foreground mt-1">({gameState.submissions?.length || 0} / {gameState.players.filter(p => p.id !== judge.id).length} submitted)</p>
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
                shuffledSubmissions.map((submission) => (
                  <Button
                    key={submission.playerId + submission.cardText} 
                    variant={selectedWinningCard === submission.cardText ? "default" : "outline"}
                    onClick={() => setSelectedWinningCard(submission.cardText)}
                    className={`w-full h-auto p-4 text-left text-lg whitespace-normal justify-start
                                ${selectedWinningCard === submission.cardText ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent' : 'border-muted hover:bg-muted/50 hover:border-foreground'}`}
                  >
                    {submission.cardText}
                  </Button>
                ))
              ) : (
                <p className="text-muted-foreground text-center">No submissions yet, or waiting for submissions to load!</p>
              )}
              <Button 
                onClick={handleWinnerSubmit} 
                disabled={!isCrownWinnerButtonActive} 
                className={cn(
                  "w-full bg-gradient-to-br from-accent/80 via-accent to-accent/70 text-accent-foreground text-lg font-semibold py-3 mt-4 border-2 border-primary",
                  isCrownWinnerButtonActive && 'animate-border-pulse'
                )}
              >
                {isPendingWinner ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                Crown the Winner!
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {gameState.gamePhase === 'judge_approval_pending' && gameState.currentScenario && (
         <>
          <ScenarioDisplay scenario={gameState.currentScenario} />
           <Card className="text-center shadow-lg border-2 border-yellow-400 rounded-xl">
             <CardHeader className="bg-yellow-100 dark:bg-yellow-900">
               <CardTitle className="text-2xl font-semibold text-yellow-700 dark:text-yellow-300">Custom Card Won!</CardTitle>
             </CardHeader>
             <CardContent className="p-6">
               <p className="text-lg mb-2">The winning card was a custom submission:</p>
               <blockquote className="text-xl font-medium p-3 bg-background/30 rounded-md border border-yellow-500 my-2">
                 "{lastRoundCardTextForModal || 'Error: Card text missing'}"
               </blockquote>
               <p className="text-md mb-4">
                 Submitted by: <strong>{lastRoundWinnerForModal?.name || 'Unknown Player'}</strong>
               </p>
               <Loader2 className="h-8 w-8 animate-spin text-yellow-600 dark:text-yellow-400 mx-auto" />
               <p className="text-muted-foreground mt-2">Awaiting your decision to add it to the main deck...</p>
             </CardContent>
           </Card>
         </>
      )}

      <AlertDialog open={showApprovalModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Approve Custom Card?</AlertDialogTitle>
            {/* Replaced AlertDialogDescription with a div for better control over nesting */}
            <div className="text-sm text-muted-foreground space-y-2 pt-2">
              <p>
                The winning card was a custom submission by <strong>{lastRoundWinnerForModal?.name || 'Unknown Player'}</strong>:
              </p>
              <blockquote className="my-1 p-3 border bg-muted rounded-md text-foreground"> {/* Ensure text is readable */}
                "{lastRoundCardTextForModal || 'Error: Card text missing'}"
              </blockquote>
              <p>
                Do you want to add this card to the game's main deck permanently?
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button 
                variant="outline" 
                onClick={() => handleApprovalDecision(false)} 
                disabled={isPendingApproval}
                className="border-destructive text-destructive-foreground hover:bg-destructive/80"
            >
                {isPendingApproval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4"/>} 
                No, Just This Round
            </Button>
            <Button 
                onClick={() => handleApprovalDecision(true)} 
                disabled={isPendingApproval}
                className="bg-green-500 hover:bg-green-600 text-white"
            >
                 {isPendingApproval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4"/>}
                Yes, Add to Deck!
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
    

    