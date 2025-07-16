
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
import { PureMorphingModal } from '../PureMorphingModal';

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

  const isBoondoggleRound = gameState.currentScenario?.category === "Boondoggles" && gameState.gamePhase === 'judging';
  
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
      <PureMorphingModal
        isOpen={true}
        onClose={() => {}}
        isDismissable={false}
        variant="image"
        className="p-0 w-auto h-auto max-w-lg bg-transparent"
      >
        <div className="relative">
          <Image
            src="/ui/waiting-for-judge-v1.png"
            alt="Waiting for the Judge to select a category"
            width={600}
            height={750}
            className="object-contain"
            priority
            data-ai-hint="waiting judge poster"
          />
          <div className="absolute top-[64%] left-1/2 -translate-x-1/2 w-[90%] text-center">
            <p className="font-im-fell text-black text-xl xl:text-2xl font-semibold leading-tight">
              The Judge is pondering which category of doom to unleash...
            </p>
            
            <div className="flex items-center justify-center space-x-2 mt-3">
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0 }} />
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
            </div>
          </div>
        </div>
      </PureMorphingModal>
    );
  }

  if (gameState.gamePhase === 'judging' && !isBoondoggleRound) {
    return (
      <PureMorphingModal
        isOpen={true}
        onClose={() => {}}
        isDismissable={false}
        variant="image"
        className="p-0 w-auto h-auto max-w-lg bg-transparent"
      >
        <div className="relative">
          <Image
            src="/ui/time-for-judgement-poster.png"
            alt="Judgement Time"
            width={600}
            height={475}
            className="object-contain"
            priority
            data-ai-hint="judgement poster"
          />
          <div className="absolute top-[78%] left-1/2 -translate-x-1/2 w-[95%] text-center">
             <p className="font-im-fell text-black text-xl xl:text-2xl font-semibold leading-none">
               All responses are in.<br/>
               Who will be crowned the <br/>
               MOST TERRIBLE?
             </p>
           
            <div className="flex items-center justify-center space-x-2 mt-3">
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0 }} />
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
              <motion.span className="block w-2.5 h-2.5 bg-black rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
            </div>
          </div>
        </div>
      </PureMorphingModal>
    );
  }

  if (isBoondoggleRound) {
     return (
        <div className="space-y-4">
            <ScenarioDisplay scenario={gameState.currentScenario} isBoondoggle={true} />
            <div className="text-center py-6">
                <h2 className="text-2xl font-im-fell text-foreground">A Boondoggle is afoot!</h2>
                <PartyPopper className="h-10 w-10 text-accent mx-auto my-4" />
                <p className="text-muted-foreground mt-1 text-lg">
                    Perform the challenge above and await the Judge's decision!
                </p>
            </div>
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
          {hasSubmittedThisRound ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-transparent backdrop-blur-sm rounded-lg z-50 flex flex-col items-center justify-start text-center p-4 pt-12"
            >
              <Image
                src="/ui/waiting-v1.png"
                alt="Waiting for other players"
                width={250}
                height={250}
                className="object-contain"
                data-ai-hint="waiting poster"
                sizes="50vw"
              />
              <p className="font-im-fell text-black text-2xl font-bold mt-4">Submission Sent!</p>
              <p className="font-im-fell text-black text-lg mt-2">Now, we wait for the others... and the Judge's verdict!</p>
              <Loader2 className="h-6 w-6 animate-spin text-black/80 mx-auto mt-4" />
            </motion.div>
          ) : (
            handWithCustomCard.map((card, index) => {
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
                      "absolute w-full h-full [backface-visibility:hidden] rounded-xl"
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
                        "absolute w-full h-full [backface-visibility:hidden] [transform:rotateX(180deg)] rounded-xl"
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
                          <div className="absolute inset-0">
                            <div className="relative w-full h-full">
                              <Textarea
                                value={customCardText}
                                onChange={(e) => setCustomCardText(e.target.value)}
                                placeholder="Make it uniquely terrible..."
                                className="absolute top-[18%] left-[50%] -translate-x-1/2 w-[85%] h-[40%] bg-transparent border-none focus-visible:ring-0 resize-none text-center text-black font-im-fell text-2xl leading-none p-2"
                                onClick={(e) => e.stopPropagation()}
                                maxLength={100}
                              />
                               {customCardText.trim().length > 0 && selectedCardId === CUSTOM_CARD_ID && (
                                <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[45%] h-[20%]">
                                    <button
                                        type="button"
                                        className="w-full h-full bg-transparent group"
                                        onClick={handleSubmit}
                                        disabled={isPending}
                                        aria-label="Submit custom card"
                                    >
                                        {isPending ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-black" />
                                        </div>
                                        ) : (
                                        <Image
                                            src="/ui/submit-card-button.png"
                                            alt="Submit Card"
                                            fill
                                            className="object-contain drop-shadow-lg transition-transform group-hover:scale-105"
                                            data-ai-hint="submit button"
                                            sizes="30vw"
                                            priority
                                        />
                                        )}
                                    </button>
                                </div>
                               )}
                            </div>
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
                            <span className="font-im-fell text-black text-2xl leading-none px-4">{card.text}</span>
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
                                    sizes="30vw"
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
                            sizes="10vw"
                            className="object-contain"
                            data-ai-hint="new card badge"
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })
          )}
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
