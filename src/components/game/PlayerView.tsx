
"use client";

import type { GameClientState, PlayerClientState, PlayerHandCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel, Edit3, CheckSquare, Sparkles, PartyPopper, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { submitResponse } from '@/app/game/actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface PlayerViewProps {
  gameState: GameClientState;
  player: PlayerClientState;
}

const CUSTOM_CARD_ID = "custom-card-id";

export default function PlayerView({ gameState, player }: PlayerViewProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [customCardText, setCustomCardText] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);

  // Animation state
  const [scenarioVisible, setScenarioVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(0);
  const [cardsFlipped, setCardsFlipped] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const hasSubmittedThisRound = useMemo(() => 
    gameState.submissions.some(sub => sub.playerId === player.id),
    [gameState.submissions, player.id]
  );
  
  const handWithCustomCard = useMemo(() => {
    // Sort the hand so the 'new' card is first, which will render it on top of the stack.
    const sortedHand = [...(player.hand || [])].sort((a, b) => {
      if (a.isNew && !b.isNew) return -1; // a (new card) comes before b
      if (!a.isNew && b.isNew) return 1; // b (new card) comes before a
      return 0;
    });

    const customCard = { id: CUSTOM_CARD_ID, text: customCardText, isCustom: true, isNew: false };
    return [...sortedHand, customCard];
  }, [player.hand, customCardText]);

  // Animation Trigger
  useEffect(() => {
    isMountedRef.current = true;
    let timers: NodeJS.Timeout[] = [];

    const startAnimation = () => {
      setIsAnimating(true);
      setScenarioVisible(false);
      setCardsVisible(0);
      setCardsFlipped(0);
      setSelectedCardId(null);
      
      timers.push(setTimeout(() => setScenarioVisible(true), 500));
      
      timers.push(setTimeout(() => {
        handWithCustomCard.forEach((_, index) => {
          timers.push(setTimeout(() => {
            if (isMountedRef.current) setCardsVisible(prev => prev + 1);
          }, (handWithCustomCard.length - 1 - index) * 150));
        });
      }, 1200));

      timers.push(setTimeout(() => {
        handWithCustomCard.forEach((_, index) => {
          timers.push(setTimeout(() => {
            if (isMountedRef.current) setCardsFlipped(prev => prev + 1);
          }, index * 120));
        });
      }, 2400));
      
      timers.push(setTimeout(() => {
        if (isMountedRef.current) setIsAnimating(false);
      }, 3800));
    };

    if (gameState.gamePhase === 'player_submission' && !hasSubmittedThisRound) {
      startAnimation();
    } else {
      setScenarioVisible(gameState.gamePhase === 'player_submission' && hasSubmittedThisRound);
    }

    return () => {
      isMountedRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, [gameState.gamePhase, gameState.currentRound, hasSubmittedThisRound, handWithCustomCard.length]);


  const handleCardClick = (cardId: string) => {
    if (isAnimating || hasSubmittedThisRound) return;
    setSelectedCardId(selectedCardId === cardId ? null : cardId);
  };
  
  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    
    if (!selectedCardId) {
      toast({ title: "No card selected!", variant: "destructive" });
      return;
    }

    const selectedCardData = handWithCustomCard.find(c => c.id === selectedCardId);
    if (!selectedCardData) return;

    const isCustom = selectedCardData.id === CUSTOM_CARD_ID;
    const textToSubmit = isCustom ? customCardText : selectedCardData.text;

    if (!textToSubmit.trim()) {
      toast({ title: "Empty card?", description: "Your card needs some text!", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      try {
        await submitResponse(player.id, textToSubmit, gameState.gameId, gameState.currentRound, isCustom);
        if (isMountedRef.current) {
          setCustomCardText('');
          setSelectedCardId(null);
        }
      } catch (error: any) {
        if (isMountedRef.current) {
          toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
        }
      }
    });
  };

  const scenarioAnimationProps = {
    initial: { opacity: 0, y: -50, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.8, ease: [0.68, -0.55, 0.265, 1.55] }
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

  if (gameState.gamePhase === 'judging') {
     return (
      <div className="space-y-6">
        <AnimatePresence>
            {gameState.currentScenario && (
                 <motion.div key={gameState.currentScenario.id}>
                    <ScenarioDisplay
                      scenario={gameState.currentScenario}
                      {...scenarioAnimationProps}
                    />
                 </motion.div>
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
  
  if (gameState.gamePhase === 'player_submission' && gameState.currentScenario) {
    return (
      <div className="space-y-2">
        <AnimatePresence>
          {scenarioVisible && gameState.currentScenario && (
            <motion.div key={gameState.currentScenario.id}>
              <ScenarioDisplay
                scenario={gameState.currentScenario}
                {...scenarioAnimationProps}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative min-h-[450px] [perspective:1000px]">
          {hasSubmittedThisRound && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg z-50 flex flex-col items-center justify-center text-center p-4">
               <VenetianMask className="h-12 w-12 text-accent mx-auto mb-3" />
               <p className="text-foreground text-xl font-semibold">Submission Sent!</p>
               <p className="text-muted-foreground mt-1">Now, we wait for the others... and the Judge's verdict!</p>
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mt-3" />
            </motion.div>
          )}

          {handWithCustomCard.map((card, index) => {
            const isVisible = index < cardsVisible;
            const isFlipped = index < cardsFlipped;
            const isThisCardSelected = selectedCardId === card.id;

            return (
              <motion.div
                key={`${card.id}-${player.id}-${index}`}
                className="absolute w-[22rem] left-0 right-0 mx-auto cursor-pointer [transform-style:preserve-3d] aspect-[1536/600]"
                style={{
                  top: 20 + (index * 35),
                  zIndex: isThisCardSelected ? 50 : 20 - index,
                }}
                animate={{
                  opacity: hasSubmittedThisRound ? 0.6 : 1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => handleCardClick(card.id)}
              >
                <motion.div
                  className="relative w-full h-full [transform-style:preserve-3d] shadow-lg rounded-xl"
                  initial={{ transform: 'translateY(300px) scale(0.8) rotateX(0deg)' }}
                  animate={{
                    transform: `
                      ${isVisible ? 'translateY(0) scale(1)' : 'translateY(300px) scale(0.8)'}
                      ${isThisCardSelected ? 'translateY(-20px) scale(1.05)' : ''}
                      ${isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)'}
                    `,
                    boxShadow: isThisCardSelected
                      ? '0 15px 40px rgba(52, 152, 219, 0.4)'
                      : '0 6px 20px rgba(0,0,0,0.15)',
                  }}
                  transition={{ duration: 0.6, ease: [0.68, -0.55, 0.265, 1.55] }}
                >
                  {/* Card Back */}
                  <div className={cn(
                    "absolute w-full h-full [backface-visibility:hidden] rounded-xl overflow-hidden"
                  )}>
                    <Image
                      src="/ui/mit-card-back.png"
                      alt="Card Back"
                      fill
                      className="object-cover"
                      data-ai-hint="card back"
                      priority
                    />
                  </div>
                  
                  {/* Card Front */}
                  <div className={cn(
                      "absolute w-full h-full [backface-visibility:hidden] [transform:rotateX(180deg)] rounded-xl overflow-hidden"
                  )}>
                    {card.isCustom ? (
                      <>
                        <Image
                          src="/ui/write-in-card-front.png"
                          alt="Write-in Response Card Front"
                          fill
                          className="object-cover"
                          data-ai-hint="card front"
                        />
                        <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 p-6 text-center">
                          {isThisCardSelected ? (
                            <>
                              <Textarea
                                value={customCardText}
                                onChange={(e) => setCustomCardText(e.target.value)}
                                placeholder="Make it uniquely terrible..."
                                className="w-[80%] h-[60%] bg-transparent border-none focus-visible:ring-0 resize-none text-center text-black font-im-fell text-2xl leading-tight p-0"
                                onClick={(e) => e.stopPropagation()}
                                maxLength={100}
                              />
                              <button
                                type="button"
                                className="bg-transparent border-none p-0 group"
                                onClick={handleSubmit}
                                disabled={isPending}
                              >
                                {isPending ? (
                                  <div className="h-[45px] w-[120px] flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                  </div>
                                ) : (
                                  <Image
                                    src="/ui/submit-card-button.png"
                                    alt="Submit Card"
                                    width={120}
                                    height={45}
                                    className="object-contain drop-shadow-lg"
                                    data-ai-hint="submit button"
                                    priority
                                  />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="font-im-fell text-black text-2xl leading-tight">Write your own...</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <Image
                          src="/ui/mit-card-front.png"
                          alt="Response Card Front"
                          fill
                          className="object-cover"
                          data-ai-hint="card front"
                        />
                        <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 p-6 text-center">
                          <span className="font-im-fell text-black text-2xl leading-tight px-4">{card.text}</span>
                          {isThisCardSelected && (
                            <button
                              type="button"
                              className="bg-transparent border-none p-0 group"
                              onClick={handleSubmit}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <div className="h-[45px] w-[120px] flex items-center justify-center">
                                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                              ) : (
                                <Image
                                  src="/ui/submit-card-button.png"
                                  alt="Submit Card"
                                  width={120}
                                  height={45}
                                  className="object-contain drop-shadow-lg"
                                  data-ai-hint="submit button"
                                  priority
                                />
                              )}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {/* New Card Badge - moved inside the card front */}
                    {card.isNew && (
                      <motion.div
                        className="absolute -top-4 -right-4 w-16 h-16 z-10 animate-pulse"
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: isFlipped ? 1 : 0, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <Image
                          src="/ui/new-card-badge.png"
                          alt="New Card"
                          fill
                          className="object-contain"
                          data-ai-hint="new card badge"
                        />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
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
