
"use client";

import type { GameClientState, PlayerClientState } from '@/lib/types'; // Updated GameState to GameClientState
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useTransition } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions';

interface PlayerViewProps {
  gameState: GameClientState; // Updated GameState to GameClientState
  player: PlayerClientState; // Updated Player to PlayerClientState
}

export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Determine if the current player has already submitted for the current round
  const hasSubmitted = gameState.submissions.some(sub => sub.playerId === player.id && gameState.currentRound > 0);

  const handleSubmit = () => {
    if (!selectedCard) {
      toast({ title: "Whoa there!", description: "You need to pick a card to submit.", variant: "destructive" });
      return;
    }
    if (!gameState.gameId || gameState.currentRound <= 0) {
      toast({ title: "Game Error", description: "Cannot submit response, game state is invalid.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      try {
        // Pass all required arguments: playerId, selectedCardText, gameId, currentRound
        await submitResponse(player.id, selectedCard, gameState.gameId, gameState.currentRound);
        toast({ title: "Response Sent!", description: "Your terrible choice is in. Good luck!" });
        setSelectedCard(''); // Clear selection after submission
      } catch (error: any) {
        console.error("PlayerView: Error submitting response:", error);
        toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
      }
    });
  };

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
            <p className="text-secondary-foreground/90 text-lg">All responses are in. The Judge is now deliberating. Who will be crowned the most terrible?</p>
            <Loader2 className="h-8 w-8 animate-spin text-secondary-foreground/70 mx-auto mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState.gamePhase !== 'player_submission' || !gameState.currentScenario) {
    // Fallback for unexpected states or if scenario isn't ready
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
      <ScenarioDisplay scenario={gameState.currentScenario} />

      <Card className="shadow-lg border-2 border-muted rounded-xl">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl font-semibold flex items-center"><ListCollapse className="mr-2 h-6 w-6 text-primary" /> Your Hand of Horrors</CardTitle>
          <CardDescription>Pick the card that best (or worst) fits the scenario.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {player.hand && player.hand.length > 0 ? player.hand.map((cardText, index) => (
            <Button
              key={cardText + '-' + index} // Ensuring key is unique if card texts could repeat
              variant={selectedCard === cardText ? "default" : "outline"}
              onClick={() => setSelectedCard(cardText)}
              className={`w-full h-auto p-4 text-left text-lg whitespace-normal justify-start
                          ${selectedCard === cardText ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent' : 'border-muted hover:bg-muted/50 hover:border-foreground'}`}
            >
              {cardText}
            </Button>
          )) : (
            <p className="text-muted-foreground text-center py-4">You're out of cards! This shouldn't happen.</p>
          )}
        </CardContent>
        <CardFooter className="p-6">
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !selectedCard || !player.hand || player.hand.length === 0 || hasSubmitted} 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg font-semibold py-3"
          >
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            {hasSubmitted ? "Already Submitted" : "Submit Your Terrible Choice"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    