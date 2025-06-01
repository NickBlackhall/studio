
"use client";

import type { GameClientState, PlayerClientState, PlayerHandCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useTransition, useEffect } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Import Badge

interface PlayerViewProps {
  gameState: GameClientState;
  player: PlayerClientState;
}

export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCardText, setSelectedCardText] = useState<string>(''); // Stores the text of the selected card
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    // Client-side logging for diagnosing 'isNew' badge
    if (player && player.hand) {
      console.log(`CLIENT PlayerView (${player.name}): Hand data:`, JSON.stringify(player.hand.map(c => ({ id: c.id, text: c.text.substring(0,10)+"...", isNew: c.isNew })), null, 2));
      console.log(`CLIENT PlayerView (${player.name}): Current Round: ${gameState.currentRound}`);
    }
  }, [player, gameState.currentRound]);

  const hasSubmitted = gameState.submissions.some(sub => sub.playerId === player.id && gameState.currentRound > 0);

  const handleSubmit = () => {
    if (!selectedCardText) {
      toast({ title: "Whoa there!", description: "You need to pick a card to submit.", variant: "destructive" });
      return;
    }
    if (!gameState.gameId || gameState.currentRound <= 0) {
      toast({ title: "Game Error", description: "Cannot submit response, game state is invalid.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      try {
        await submitResponse(player.id, selectedCardText, gameState.gameId, gameState.currentRound);
        toast({ title: "Response Sent!", description: "Your terrible choice is in. Good luck!" });
        setSelectedCardText('');
      } catch (error: any) {
        console.error("PlayerView: Error submitting response:", error);
        toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
      }
    });
  };

  const isSubmitButtonActive = !isPending && !!selectedCardText && !!player.hand && player.hand.length > 0 && !hasSubmitted;

  if (gameState.gamePhase === 'category_selection') {
    return (
       <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-muted-foreground">Waiting for Judge</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground mt-4">The Judge is pondering which category of doom to unleash...</p>
        </CardContent>
      </Card>
    );
  }

  if (!gameState.currentScenario && gameState.gamePhase === 'player_submission') {
     return (
       <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-muted-foreground">Patience, terrible one...</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground mt-4">The scenario is being prepared. Brace yourself.</p>
        </CardContent>
      </Card>
    );
  }


  if (hasSubmitted && gameState.gamePhase === 'player_submission') {
    return (
      <div className="space-y-6">
        {gameState.currentScenario && <ScenarioDisplay scenario={gameState.currentScenario} />}
        <Card className="text-center shadow-lg border-2 border-accent rounded-xl">
          <CardHeader className="bg-accent text-accent-foreground p-6">
            <CardTitle className="text-2xl font-semibold flex items-center justify-center"><VenetianMask className="mr-2 h-6 w-6" /> Submission Sent!</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-accent-foreground/90 text-lg">Your terrible response is locked in. Now, we wait for the others... and the Judge's verdict!</p>
             <Loader2 className="h-8 w-8 animate-spin text-accent-foreground/70 mx-auto mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState.gamePhase === 'judging') {
     return (
      <div className="space-y-6">
        {gameState.currentScenario && <ScenarioDisplay scenario={gameState.currentScenario} />}
        <Card className="text-center shadow-lg border-2 border-secondary rounded-xl">
          <CardHeader className="bg-secondary text-secondary-foreground p-6">
            <CardTitle className="text-2xl font-semibold flex items-center justify-center"><Gavel className="mr-2 h-6 w-6" /> Judgment Time!</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-lg">
              All responses are in. The Judge is now deliberating. Who will be crowned the most terrible?
            </p>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState.gamePhase !== 'player_submission' || !gameState.currentScenario) {
    return (
      <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
       <CardHeader>
         <CardTitle className="text-2xl font-semibold text-muted-foreground">Waiting for Game to Progress</CardTitle>
       </CardHeader>
       <CardContent className="p-6">
         <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
         <p className="text-muted-foreground mt-4">The game phase is: {gameState.gamePhase}</p>
       </CardContent>
     </Card>
    );
  }


  return (
    <div className="space-y-6">
      {gameState.currentScenario && <ScenarioDisplay scenario={gameState.currentScenario} />}

      <Card className="shadow-lg border-2 border-muted rounded-xl">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl font-semibold flex items-center"><ListCollapse className="mr-2 h-6 w-6 text-primary" /> Your Hand of Horrors</CardTitle>
          <CardDescription>Pick the card that best (or worst) fits the scenario.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {player.hand && player.hand.length > 0 ? player.hand.map((card: PlayerHandCard) => (
            <Button
              key={card.id}
              variant={selectedCardText === card.text ? "default" : "outline"}
              onClick={() => setSelectedCardText(card.text)}
              className={cn(
                `w-full h-auto p-4 text-left text-lg whitespace-normal justify-start relative`,
                selectedCardText === card.text ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent' : 'border-gray-400 hover:bg-muted/50 hover:border-foreground'
              )}
            >
              <span>{card.text}</span>
              {card.isNew && gameState.currentRound > 1 && (
                <Badge variant="secondary" className="absolute top-1 right-1 text-xs px-1.5 py-0.5">New</Badge>
              )}
            </Button>
          )) : (
            <p className="text-muted-foreground text-center py-4">You're out of cards! This shouldn't happen.</p>
          )}
        </CardContent>
        <CardFooter className="p-6">
          <Button
            onClick={handleSubmit}
            disabled={!isSubmitButtonActive}
            className={cn(
              "w-full bg-accent text-accent-foreground text-lg font-semibold py-3 border-2 border-primary",
              isSubmitButtonActive && !isPending && 'animate-border-pulse'
            )}
          >
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            {hasSubmitted ? "Already Submitted" : "Submit Your Terrible Choice"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
