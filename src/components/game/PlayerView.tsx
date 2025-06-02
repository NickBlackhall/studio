
"use client";

import type { GameClientState, PlayerClientState, PlayerHandCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState, useTransition, useEffect } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel, Edit3, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions';
import { cn } from '@/lib/utils';

interface PlayerViewProps {
  gameState: GameClientState;
  player: PlayerClientState;
}

const CUSTOM_CARD_PLACEHOLDER = "Write your own card"; // Emoji removed
const CUSTOM_CARD_ID = "custom-write-in-card"; 

export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCardText, setSelectedCardText] = useState<string>('');
  const [isCustomCardSelectedAsSubmissionTarget, setIsCustomCardSelectedAsSubmissionTarget] = useState<boolean>(false);
  
  const [isEditingCustomCard, setIsEditingCustomCard] = useState<boolean>(false);
  const [customCardInputText, setCustomCardInputText] = useState<string>(''); 
  const [finalizedCustomCardText, setFinalizedCustomCardText] = useState<string>(''); 

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (gameState.currentRound > 0) { 
        setIsEditingCustomCard(false);
        setCustomCardInputText('');
        setFinalizedCustomCardText('');
        setSelectedCardText('');
        setIsCustomCardSelectedAsSubmissionTarget(false);
    }
  }, [gameState.currentRound, player.isJudge]);


  const hasSubmittedThisRound = gameState.submissions.some(
    sub => sub.playerId === player.id && gameState.currentRound > 0 && gameState.currentRound === (gameState.submissions.find(s => s.playerId === player.id)?.cardText ? gameState.currentRound : -1) 
  ) || gameState.submissions.some(sub => sub.playerId === player.id && gameState.currentRound > 0 && (gameState.responses?.find((r: any) => r.player_id === player.id && r.round_number === gameState.currentRound) !== undefined ) );


  const handleCustomCardEdit = () => {
    setCustomCardInputText(finalizedCustomCardText); 
    setIsEditingCustomCard(true);
    setSelectedCardText(''); 
    setIsCustomCardSelectedAsSubmissionTarget(false);
  };

  const handleCustomCardDone = () => {
    if (customCardInputText.trim() === '') {
        toast({ title: "Empty?", description: "Your custom card needs some text!", variant: "destructive"});
        setFinalizedCustomCardText('');
    } else {
        setFinalizedCustomCardText(customCardInputText.trim());
    }
    setIsEditingCustomCard(false);
    if (customCardInputText.trim()) {
        setSelectedCardText(customCardInputText.trim());
        setIsCustomCardSelectedAsSubmissionTarget(true);
    }
  };
  
  const handleSelectCard = (cardText: string, isCustom: boolean) => {
    setSelectedCardText(cardText);
    setIsCustomCardSelectedAsSubmissionTarget(isCustom);
     if (isCustom && !finalizedCustomCardText && !isEditingCustomCard) {
      handleCustomCardEdit();
    }
  };

  const handleSubmit = () => {
    if (!selectedCardText && !finalizedCustomCardText) {
      toast({ title: "Whoa there!", description: "You need to pick a card or write one to submit.", variant: "destructive" });
      return;
    }
    if (!gameState.gameId || gameState.currentRound <= 0) {
      toast({ title: "Game Error", description: "Cannot submit response, game state is invalid.", variant: "destructive" });
      return;
    }

    const textToSubmit = isCustomCardSelectedAsSubmissionTarget ? finalizedCustomCardText : selectedCardText;
    if (!textToSubmit.trim()) {
        toast({ title: "Empty Submission", description: "Your selected card is empty.", variant: "destructive"});
        return;
    }

    startTransition(async () => {
      try {
        await submitResponse(player.id, textToSubmit, gameState.gameId, gameState.currentRound, isCustomCardSelectedAsSubmissionTarget);
        toast({ title: "Response Sent!", description: "Your terrible choice is in. Good luck!" });
        
        setSelectedCardText('');
        setIsCustomCardSelectedAsSubmissionTarget(false);
        setFinalizedCustomCardText(''); 
        setCustomCardInputText('');

      } catch (error: any) {
        console.error("PlayerView: Error submitting response:", error);
        toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
      }
    });
  };

  const isSubmitButtonActive = !isPending && !!selectedCardText.trim() && !hasSubmittedThisRound;


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


  if (hasSubmittedThisRound && gameState.gamePhase === 'player_submission') {
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
          <CardDescription>Pick a card, or write your own masterpiece of terrible.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {/* Custom Card Slot */}
          {isEditingCustomCard ? (
            <div className="space-y-2 p-3 border-2 border-accent rounded-md shadow-md bg-background">
              <Textarea
                placeholder="Make it wonderfully terrible..."
                value={customCardInputText}
                onChange={(e) => setCustomCardInputText(e.target.value)}
                maxLength={100}
                rows={3}
                className="text-base border-muted focus:border-accent"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" size="sm" onClick={() => { setIsEditingCustomCard(false); setCustomCardInputText(finalizedCustomCardText); }}>Cancel</Button>
                <Button onClick={handleCustomCardDone} size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <CheckSquare className="mr-2 h-4 w-4" /> Done
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleSelectCard(finalizedCustomCardText || CUSTOM_CARD_PLACEHOLDER, true)}
              className={cn(
                `w-full h-auto p-4 text-left text-lg whitespace-normal justify-start relative min-h-[60px]`,
                isCustomCardSelectedAsSubmissionTarget
                  ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent'
                  : 'border-dashed border-accent hover:border-accent-foreground hover:bg-accent/10',
                finalizedCustomCardText ? 'border-solid border-accent' : 'border-dashed border-accent' 
              )}
            >
              <span>{finalizedCustomCardText || CUSTOM_CARD_PLACEHOLDER}</span>
              {!finalizedCustomCardText && (
                <Edit3 className="absolute top-1/2 right-3 transform -translate-y-1/2 h-5 w-5 text-accent opacity-70" />
              )}
               {finalizedCustomCardText && !isCustomCardSelectedAsSubmissionTarget && (
                 <Edit3 className="absolute top-1/2 right-3 transform -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100" onClick={(e) => {e.stopPropagation(); handleCustomCardEdit(); }}/>
               )}
            </Button>
          )}

          {/* Regular Hand Cards */}
          {player.hand && player.hand.length > 0 && player.hand.map((card: PlayerHandCard) => {
            const isNewCardVisual = card.isNew && gameState.currentRound > 1; 
            return (
              <Button
                key={card.id}
                variant="outline"
                onClick={() => handleSelectCard(card.text, false)}
                className={cn(
                  `w-full h-auto p-4 text-left text-lg whitespace-normal justify-start relative min-h-[60px]`,
                  selectedCardText === card.text && !isCustomCardSelectedAsSubmissionTarget
                    ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent'
                    : (isNewCardVisual
                        ? 'border-red-500 hover:border-red-600' // Changed from accent to red for "New!"
                        : 'border-gray-400 hover:border-foreground' // Default border
                      ),
                  selectedCardText !== card.text && 'hover:bg-muted/50'
                )}
              >
                <span>{card.text}</span>
                {isNewCardVisual && (
                  <span className="absolute bottom-2 right-3 text-red-400 font-semibold text-sm">
                    New!
                  </span>
                )}
              </Button>
            );
          })}
          {(player.hand?.length || 0) === 0 && !isEditingCustomCard && !finalizedCustomCardText && (
             <p className="text-muted-foreground text-center py-4">You're out of pre-dealt cards! Write one above.</p>
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
            {hasSubmittedThisRound ? "Already Submitted" : "Submit Your Terrible Choice"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


    