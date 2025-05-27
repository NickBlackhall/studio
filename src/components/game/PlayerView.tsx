
"use client";

import type { GameState, Player } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardFooter
import { useState, useTransition } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel } from 'lucide-react'; // Added Gavel, ListCollapse
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions'; // Import the Server Action

interface PlayerViewProps {
  gameState: GameState;
  player: Player;
  // onSubmitResponse: (cardText: string) => Promise<void>; // Removed prop
}

export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const hasSubmitted = gameState.submissions.some(sub => sub.playerId === player.id);

  const handleSubmit = () => {
    if (!selectedCard) {
      toast({ title: "Whoa there!", description: "You need to pick a card to submit.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      await submitResponse(player.id, selectedCard); // Call Server Action directly
      toast({ title: "Response Sent!", description: "Your terrible choice is in. Good luck!" });
      setSelectedCard(''); // Clear selection after submission
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
  
  if (!gameState.currentScenario) {
     return (
       <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-muted-foreground">Patience, terrible one...</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-muted-foreground">The scenario is being prepared. Brace yourself.</p>
        </CardContent>
      </Card>
    );
  }


  if (hasSubmitted && gameState.gamePhase === 'player_submission') {
    return (
      <div className="space-y-6">
        <ScenarioDisplay scenario={gameState.currentScenario} />
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
        <ScenarioDisplay scenario={gameState.currentScenario} />
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
              key={index}
              variant={selectedCard === cardText ? "default" : "outline"}
              onClick={() => setSelectedCard(cardText)}
              className={`w-full h-auto p-4 text-left text-lg whitespace-normal justify-start
                          ${selectedCard === cardText ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent' : 'border-muted hover:bg-muted/50 hover:border-foreground'}`}
            >
              {cardText}
            </Button>
          )) : (
            <p className="text-muted-foreground text-center">You're out of cards! This shouldn't happen.</p>
          )}
        </CardContent>
        <CardFooter className="p-6">
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !selectedCard || player.hand.length === 0} 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg font-semibold py-3"
          >
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            Submit Your Terrible Choice
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
