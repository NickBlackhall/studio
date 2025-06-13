
"use client";

import type { GameClientState, PlayerClientState, PlayerHandCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState, useTransition, useEffect, useRef } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel, Edit3, CheckSquare, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerViewProps {
  gameState: GameClientState;
  player: PlayerClientState;
}

const CUSTOM_CARD_PLACEHOLDER = "Write your own card";
const CUSTOM_CARD_ID_EDIT = "custom-card-edit-slot";
const CUSTOM_CARD_ID_DISPLAY = "custom-card-display-slot";

const handContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.091, 
      delayChildren: 0.2,   
    },
  },
};

const cardCascadeVariants = {
  hidden: { opacity: 0 }, // Cards start transparent
  visible: { // Cards fade in
    opacity: 1,
    transition: { duration: 0.2 } 
  },
  exit: { opacity: 0, y: 20, transition: { duration: 0.25, ease: "easeIn" } }, 
};


const customCardSlotInitial = { opacity: 0, y: -10 };
const customCardSlotAnimate = { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut", delay: 0.1 } };
const customCardSlotExit = { opacity: 0, transition: { duration: 0.2 }};


export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCardText, setSelectedCardText] = useState<string>('');
  const [isCustomCardSelectedAsSubmissionTarget, setIsCustomCardSelectedAsSubmissionTarget] = useState<boolean>(false);

  const [isEditingCustomCard, setIsEditingCustomCard] = useState<boolean>(false);
  const [customCardInputText, setCustomCardInputText] = useState<string>('');
  const [finalizedCustomCardText, setFinalizedCustomCardText] = useState<string>('');

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hasSubmittedThisRound = gameState.submissions.some(sub => sub.playerId === player.id);

  useEffect(() => {
    if (player && (gameState.currentRound > 0 && (player.isJudge || gameState.gamePhase !== 'player_submission' || hasSubmittedThisRound))) {
        setIsEditingCustomCard(false);
        setCustomCardInputText('');
        setFinalizedCustomCardText('');
        setSelectedCardText('');
        setIsCustomCardSelectedAsSubmissionTarget(false);
    }
  }, [gameState.currentRound, player?.isJudge, gameState.gamePhase, player, hasSubmittedThisRound]);


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
    if (!gameState.gameId || gameState.currentRound <= 0 || !player) {
      toast({ title: "Game Error", description: "Cannot submit response, game state or player is invalid.", variant: "destructive" });
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
      } catch (error: any) {
        if (isMountedRef.current) {
            toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
        }
      }
    });
  };


  if (!player) {
    return (
      <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
        <CardHeader><CardTitle className="text-muted-foreground">Player data not available.</CardTitle></CardHeader>
        <CardContent><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></CardContent>
      </Card>
    );
  }

  const isSubmitButtonActive = !isPending && !!selectedCardText.trim() && !hasSubmittedThisRound;

  const scenarioAnimationProps = {
    initial: { opacity: 0, scale: 0.90 },
    animate: { opacity: 1, scale: 1, transition: { duration: 1.0, ease: [0.04, 0.62, 0.23, 0.98] } },
    exit: { opacity: 0, scale: 0.90, transition: { duration: 0.8, ease: [0.04, 0.62, 0.23, 0.98] } }
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

  if (gameState.gamePhase === 'player_submission' && gameState.currentScenario) {
    const showHandUi = !hasSubmittedThisRound;
    const showSubmissionSentUi = hasSubmittedThisRound;

    return (
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {gameState.currentScenario && (
               <ScenarioDisplay
                  key={gameState.currentScenario.id || 'scenario-submission-active'}
                  scenario={gameState.currentScenario}
                  {...scenarioAnimationProps}
                />
          )}
        </AnimatePresence>

        <Card className="shadow-lg border-2 border-muted rounded-xl overflow-hidden">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-semibold flex items-center"><ListCollapse className="mr-2 h-6 w-6 text-primary" /> Your Hand of Horrors</CardTitle>
            <CardDescription>Pick a card, or write your own masterpiece of terrible.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            {showSubmissionSentUi && (
              <motion.div
                key="submission-sent-view-main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.5} }}
                className="text-center py-8 min-h-[250px] flex flex-col items-center justify-center"
              >
                <VenetianMask className="mr-2 h-12 w-12 text-accent mx-auto mb-3" />
                <p className="text-accent-foreground/90 text-xl font-semibold">Submission Sent!</p>
                <p className="text-muted-foreground mt-1">Now, we wait for the others... and the Judge's verdict!</p>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mt-3" />
              </motion.div>
            )}
            {showHandUi && (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {isEditingCustomCard ? (
                    <motion.div
                      key={CUSTOM_CARD_ID_EDIT}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: { duration: 0.3 } }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                      layout
                      className="space-y-2 p-3 border-2 border-accent rounded-md shadow-md bg-background"
                    >
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
                    </motion.div>
                  ) : (
                    <motion.button
                      key={CUSTOM_CARD_ID_DISPLAY}
                      initial={customCardSlotInitial}
                      animate={customCardSlotAnimate}
                      exit={customCardSlotExit}
                      layout
                      onClick={() => handleSelectCard(finalizedCustomCardText || CUSTOM_CARD_PLACEHOLDER, true)}
                      className={cn(
                        `w-full h-auto p-4 text-left text-lg whitespace-normal justify-start relative min-h-[60px] rounded-md group border-2`,
                        isCustomCardSelectedAsSubmissionTarget
                          ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent'
                          : finalizedCustomCardText
                            ? 'border-solid border-accent hover:border-accent-foreground hover:bg-accent/10'
                            : 'border-dashed border-accent hover:border-accent-foreground hover:bg-accent/10'
                      )}
                    >
                      <span>{finalizedCustomCardText || CUSTOM_CARD_PLACEHOLDER}</span>
                      {!finalizedCustomCardText && (
                        <Edit3 className="absolute top-1/2 right-3 transform -translate-y-1/2 h-5 w-5 text-accent opacity-70 group-hover:opacity-100 transition-opacity" />
                      )}
                       {finalizedCustomCardText && !isCustomCardSelectedAsSubmissionTarget && (
                         <Edit3 className="absolute top-1/2 right-3 transform -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" onClick={(e) => {e.stopPropagation(); handleCustomCardEdit(); }}/>
                       )}
                    </motion.button>
                  )}
                </AnimatePresence>

                <motion.div
                  className="space-y-3"
                  variants={handContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence>
                    {player.hand &&
                      Array.isArray(player.hand) &&
                      player.hand.map((card: PlayerHandCard) => {
                        const isNewCardVisual = card.isNew === true;
                        return (
                          <motion.button
                            key={'card-' + card.id}
                            variants={cardCascadeVariants}
                            layout // Keep layout for smooth reordering when a card is removed/added
                            onClick={() => handleSelectCard(card.text, false)}
                            className={cn(
                              `w-full h-auto p-3 text-left text-sm md:text-base whitespace-normal justify-start relative rounded-md border shadow-md`,
                              selectedCardText === card.text && !isCustomCardSelectedAsSubmissionTarget
                                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-accent'
                                : isNewCardVisual
                                  ? 'border-red-500'
                                  : 'border-gray-400 hover:border-foreground bg-card',
                              selectedCardText !== card.text && !isNewCardVisual && 'hover:bg-muted/50'
                            )}
                          >
                            <span>{card.text}</span>
                            {isNewCardVisual && (
                               <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1, transition: { delay: 0.1, type: 'spring', stiffness: 200, damping: 10 } }}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md flex items-center"
                                >
                                  NEW <Sparkles className="inline-block h-2.5 w-2.5 ml-0.5" />
                                </motion.span>
                            )}
                          </motion.button>
                        );
                    })}
                  </AnimatePresence>
                </motion.div>
              </div>
            )}
          </CardContent>
          {showHandUi && (
            <CardFooter className="p-6 pt-3">
              <Button
                onClick={handleSubmit}
                disabled={!isSubmitButtonActive}
                className={cn(
                  "w-full bg-accent text-accent-foreground text-lg font-semibold py-3 border-2 border-primary",
                  isSubmitButtonActive && !isPending && 'animate-border-pulse'
                )}
              >
                {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Submit Your Terrible Choice
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  if (gameState.gamePhase === 'judging') {
     return (
      <div className="space-y-6">
        <AnimatePresence mode="wait">
            {gameState.currentScenario && (
                 <ScenarioDisplay
                    key={gameState.currentScenario.id || 'scenario-judging'}
                    scenario={gameState.currentScenario}
                    {...scenarioAnimationProps}
                  />
            )}
        </AnimatePresence>
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

  return (
    <Card className="text-center shadow-lg border-2 border-dashed border-muted rounded-xl">
     <CardHeader>
       <CardTitle className="text-2xl font-semibold text-muted-foreground">Waiting for Game to Progress</CardTitle>
     </CardHeader>
     <CardContent className="p-6">
       <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
       <p className="text-muted-foreground mt-4">Current phase: {gameState.gamePhase}. Your view will update shortly.</p>
     </CardContent>
   </Card>
  );
}

