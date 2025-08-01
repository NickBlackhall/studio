
"use client";

import type { GameClientState, PlayerClientState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { Gavel, Send, CheckCircle, Loader2, Crown, PlusCircle, XCircle, SkipForward, Award, HelpCircle, PartyPopper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/contexts/AudioContext';
import ScenarioDisplay from './ScenarioDisplay';
import { cn } from '@/lib/utils';
import { handleJudgeApprovalForCustomCard, nextRound } from '@/app/game/actions';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import SwipeableCategorySelector from './SwipeableCategorySelector';
import { PureMorphingModal } from '../PureMorphingModal';

interface JudgeViewProps {
  gameState: GameClientState;
  judge: PlayerClientState;
  onSelectCategory: (category: string) => Promise<void>;
  onSelectWinner: (cardText: string, boondoggleWinnerId?: string) => Promise<void>;
}

const BoondoggleRulesContent = () => (
    <div className="space-y-4 text-left text-white/90">
      <div>
        <h4 className="font-bold text-lg text-yellow-300">🏃 Physical Challenges</h4>
        <p className="text-sm">Players perform the challenge described. Award the point to whoever does it best, fastest, or most creatively!</p>
      </div>
      <div>
        <h4 className="font-bold text-lg text-yellow-300">👥 Famous Duos</h4>
        <p className="text-sm">Players take turns naming famous pairs (e.g., Batman & Robin) going around the circle. When someone can't think of one, they're out. Last person standing wins!</p>
      </div>
      <div>
        <h4 className="font-bold text-lg text-yellow-300">😱 What's Worse</h4>
        <p className="text-sm">Players call out scenarios that are worse than the one described. Award the point to the funniest, most creative, or most convincingly terrible answer!</p>
      </div>
    </div>
);

export default function JudgeView({ gameState, judge, onSelectCategory, onSelectWinner }: JudgeViewProps) {
  const [selectedWinningCard, setSelectedWinningCard] = useState<string>('');
  const [pendingWinnerCard, setPendingWinnerCard] = useState<string>('');
  const [isPendingCategory, startTransitionCategory] = useTransition();
  const [isPendingApproval, startTransitionApproval] = useTransition();
  const [isPendingBoondoggle, startTransitionBoondoggle] = useTransition();
  const [isPendingSkip, startTransitionSkip] = useTransition();
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Touch handling for swipe detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeOccurredRef = useRef(false);
  
  // Drag state for visual feedback
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  
  // Animation sequence state
  const [exitingCardId, setExitingCardId] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<'left' | 'right'>('right');
  const [slidingUp, setSlidingUp] = useState(false);
  
  // Card order state for shuffling
  const [cardOrder, setCardOrder] = useState<string[]>([]);

  const { toast } = useToast();
  const { playSfx } = useAudio();
  
  const [shuffledSubmissions, setShuffledSubmissions] = useState<GameClientState['submissions']>([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const isMountedRef = useRef(true);
  const prefersReducedMotion = useReducedMotion();
  
  // Create ordered submissions for swiping
  const orderedSubmissions = useMemo(() => {
    if (cardOrder.length === 0 && shuffledSubmissions.length > 0) {
      const initialOrder = shuffledSubmissions.map((_, index) => index.toString());
      setCardOrder(initialOrder);
      return shuffledSubmissions;
    }
    
    if (cardOrder.length !== shuffledSubmissions.length) {
      const newOrder = shuffledSubmissions.map((_, index) => index.toString());
      setCardOrder(newOrder);
      return shuffledSubmissions;
    }
    
    // Return submissions in the current shuffled order
    return cardOrder.map(indexStr => shuffledSubmissions[parseInt(indexStr)]).filter(Boolean);
  }, [shuffledSubmissions, cardOrder]);

  const showApprovalModal = gameState.gamePhase === 'judge_approval_pending' && gameState.currentJudgeId === judge.id;
  const isBoondoggleRound = gameState.currentScenario?.category === "Boondoggles" && gameState.gamePhase === 'judging';

  // Play devil laughter sound when boondoggle is revealed
  useEffect(() => {
    if (isBoondoggleRound) {
      playSfx('boondoggle');
    }
  }, [isBoondoggleRound, playSfx]);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    if (gameState.gamePhase === 'judging' && !isAnimationComplete && !isBoondoggleRound) {
      if (shuffledSubmissions.length !== gameState.submissions.length || shuffledSubmissions.length === 0) {
        setShuffledSubmissions([...gameState.submissions].sort(() => Math.random() - 0.5));
      }
      
      if (prefersReducedMotion) {
        setIsAnimationComplete(true);
      }
    }
    
    if (gameState.gamePhase !== 'judging' && (isAnimationComplete || shuffledSubmissions.length > 0)) {
      setIsAnimationComplete(false);
      setShuffledSubmissions([]);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [gameState.gamePhase, gameState.submissions, isAnimationComplete, prefersReducedMotion, shuffledSubmissions.length, isBoondoggleRound]);
  
  // Shuffle function for card reordering
  const shuffleCard = (submissionIndex: number, direction: 'left' | 'right' = 'right') => {
    const isShuffleAnimating = exitingCardId !== null || slidingUp;
    
    if (isShuffleAnimating || !isAnimationComplete) {
      return;
    }
    
    const cardId = submissionIndex.toString();
    
    // Clear selection if the card being shuffled is currently selected
    if (selectedWinningCard === orderedSubmissions[submissionIndex]?.cardText) {
      setSelectedWinningCard('');
    }
    
    // Step 1: Card slides away (300ms)
    setExitingCardId(cardId);
    setExitDirection(direction);
    
    setTimeout(() => {
      // Step 2: Update card order
      setCardOrder(prevOrder => {
        const newOrder = [...prevOrder];
        const cardIndex = newOrder.indexOf(cardId);
        if (cardIndex !== -1) {
          const [card] = newOrder.splice(cardIndex, 1);
          newOrder.push(card);
        }
        return newOrder;
      });
      
      // Step 3: Other cards slide up to fill gap
      setSlidingUp(true);
      
      setTimeout(() => {
        // Step 4: Reset animation states
        setExitingCardId(null);
        setSlidingUp(false);
      }, 250);
    }, 300);
  };
  
  // Touch event handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent, submissionIndex: number) => {
    const touch = e.touches[0];
    swipeOccurredRef.current = false;
    setDraggingCardId(submissionIndex.toString());
    setDragOffset({ x: 0, y: 0 });
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchMove = (e: React.TouchEvent, submissionIndex: number) => {
    if (!touchStartRef.current || draggingCardId !== submissionIndex.toString()) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = (e: React.TouchEvent, submissionIndex: number) => {
    if (!touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    
    // Calculate distance and velocity
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;
    
    // Swipe thresholds
    const minDistance = 40;
    const minVelocity = 0.3;
    
    // Determine swipe direction (horizontal swipes need to be more horizontal than vertical)
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if ((distance > minDistance || velocity > minVelocity) && isHorizontal) {
      const direction = deltaX > 0 ? 'right' : 'left';
      swipeOccurredRef.current = true;
      shuffleCard(submissionIndex, direction);
    }
    
    // Reset drag state
    setDragOffset(null);
    setDraggingCardId(null);
    
    // Reset swipe flag after a short delay to allow click prevention
    setTimeout(() => {
      swipeOccurredRef.current = false;
    }, 100);
    
    touchStartRef.current = null;
  };
  
  const handleUnleashScenario = (category: string) => {
    if (!category) {
      toast({ title: "Hold up!", description: "Please select a category first.", variant: "destructive" });
      return;
    }
    startTransitionCategory(async () => {
      await onSelectCategory(category);
    });
  };
  
  const handleAwardBoondogglePoint = (winnerId: string) => {
    startTransitionBoondoggle(async () => {
        try {
            // For boondoggles, the "winning card text" is irrelevant for logic,
            // but we pass an empty string for parameter consistency. The action will use the scenario text.
            await onSelectWinner("", winnerId);
        } catch (error: any) {
            toast({ title: "Error Awarding Point", description: error.message, variant: "destructive" });
        }
    });
  };
  
  const handleSkipBoondoggle = () => {
    if (!gameState.gameId) return;
    startTransitionSkip(async () => {
        try {
            await nextRound(gameState.gameId);
            toast({ title: "Boondoggle Skipped", description: "On to the next round!" });
        } catch (error: any) {
            toast({ title: "Error Skipping", description: error.message, variant: "destructive" });
        }
    });
  };

  const handleWinnerSubmit = async (cardText: string) => {
    if (!cardText) {
        toast({ title: "Error", description: "Card text is missing.", variant: "destructive" });
        return;
    }

    if (pendingWinnerCard) {
        return;
    }

    playSfx('crown-winner');
    setPendingWinnerCard(cardText);
    
    try {
        await onSelectWinner(cardText);
        
        setSelectedWinningCard('');
    } catch (error: any) {
        toast({ title: "Error selecting winner", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
        if (isMountedRef.current) {
          setPendingWinnerCard('');
        }
    }
  };
  
  const handleCardClick = (cardText: string, submissionIndex: number) => {
    // Only block clicks during shuffle animations and if pending winner
    const isShuffleAnimating = exitingCardId !== null || slidingUp;
    if (isShuffleAnimating || !!pendingWinnerCard || swipeOccurredRef.current) {
        return;
    }
    
    // Only allow clicks on the top card (index 0) after animation is complete
    if (!isAnimationComplete || submissionIndex !== 0) {
        return;
    }
    
    setSelectedWinningCard(prevSelected => {
        const newSelected = prevSelected === cardText ? '' : cardText;
        return newSelected;
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
  
  const lastRoundWinnerForModal = gameState.lastWinner?.player;
  const lastRoundCardTextForModal = gameState.lastWinner?.cardText;
  
  const scenarioAnimationProps = {
    initial: { opacity: 0, scale: 0.90 },
    animate: { opacity: 1, scale: 1, transition: { duration: 1.0, ease: [0.04, 0.62, 0.23, 0.98] } }, 
    exit: { opacity: 0, scale: 0.90, transition: { duration: 0.8, ease: [0.04, 0.62, 0.23, 0.98] } } 
  };
  
  return (
    <div className="space-y-4">
      {gameState.gamePhase === 'category_selection' && (
        <SwipeableCategorySelector
          categories={gameState.categories}
          onUnleashScenario={handleUnleashScenario}
          isPending={isPendingCategory}
        />
      )}
      
      {gameState.gamePhase === 'player_submission' && (
        <>
          <AnimatePresence mode="wait">
            {gameState.currentScenario && (
              <ScenarioDisplay
                key={gameState.currentScenario.id || 'scenario-player-submission-judge'}
                scenario={gameState.currentScenario}
                {...scenarioAnimationProps}
              />
            )}
          </AnimatePresence>
          <div className="text-center py-6">
            <h2 className="text-2xl font-im-fell text-foreground">Players are making terrible choices...</h2>
            <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto my-4" />
            <p className="text-muted-foreground mt-1 text-lg">
              ({gameState.submissions?.length || 0} / {gameState.players.filter(p => p.id !== judge.id).length} submitted)
            </p>
          </div>
          <div className="relative mt-12 min-h-[450px] [perspective:1200px]">
            <AnimatePresence>
              {gameState.submissions.map((submission, index) => (
                <motion.div
                  key={submission.playerId}
                  className="absolute w-80 left-0 right-0 mx-auto will-change-transform"
                  style={{ zIndex: index }}
                  initial={{ opacity: 0, y: -100 }}
                  animate={{
                    opacity: 1,
                    y: index * 30,
                    scale: 1 - (gameState.submissions.length - 1 - index) * 0.05,
                    transition: { type: 'spring', stiffness: 100, damping: 15 }
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="relative aspect-[1536/600] [backface-visibility:hidden] rounded-xl overflow-hidden shadow-lg">
                    <Image src="/ui/mit-card-back.png" alt="Response Card Front" fill className="object-cover" data-ai-hint="card back" sizes="320px"/>
                    <div className="absolute inset-0 flex flex-col justify-center items-center">
                      <Loader2 className="h-10 w-10 animate-spin text-black/50"/>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
      
      {gameState.gamePhase === 'judging' && !isBoondoggleRound && (
        <>
          <AnimatePresence mode="wait">
           {gameState.currentScenario && (
              <ScenarioDisplay
                key={gameState.currentScenario.id || 'scenario-judging-active'}
                scenario={gameState.currentScenario}
                {...scenarioAnimationProps}
              />
            )}
          </AnimatePresence>
          
          <div 
            className="relative mt-12 min-h-[450px] [perspective:1000px]"
            style={{
              touchAction: draggingCardId ? 'none' : 'pan-y'
            }}
          >
            {orderedSubmissions.map((submission, index) => {
              const isSelected = selectedWinningCard === submission.cardText;
              const isPending = pendingWinnerCard === submission.cardText;
              const cardId = cardOrder[index];
              const originalIndex = parseInt(cardId);
              
              return (
                <motion.div
                  key={submission.playerId}
                  className={`absolute w-full max-w-sm mx-auto left-0 right-0 [transform-style:preserve-3d] aspect-[1536/600] ${index === 0 ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    top: 20 + (index * 25),
                    zIndex: isSelected ? 50 : 20 - index,
                    touchAction: index === 0 ? 'none' : 'auto'
                  }}
                   animate={{
                    // Base position based on card reveal animation
                    y: isAnimationComplete ? index * 25 : index * 30,
                    scale: isAnimationComplete && isSelected ? 1.1 : (isAnimationComplete ? 1 : 1 - (orderedSubmissions.length - 1 - index) * 0.05),
                    
                    // Drag state (immediate, no transition)
                    ...(draggingCardId === cardId && dragOffset && {
                      x: dragOffset.x,
                      y: (isAnimationComplete ? index * 25 : index * 30) + dragOffset.y
                    }),
                    
                    // Exit animation for shuffle
                    ...(exitingCardId === cardId && {
                      x: exitDirection === 'right' ? window.innerWidth : -window.innerWidth
                    }),
                    
                    // Slide up animation during shuffle
                    ...(slidingUp && index > 0 && cardId !== exitingCardId && {
                      y: (isAnimationComplete ? index * 25 : index * 30) - 25
                    }),
                    
                    transition: { 
                      type: draggingCardId === cardId ? 'tween' :
                           exitingCardId === cardId ? 'tween' :
                           slidingUp ? 'tween' : 'spring',
                      stiffness: 100, 
                      damping: 15, 
                      duration: draggingCardId === cardId ? 0 :
                               exitingCardId === cardId ? 0.3 :
                               slidingUp ? 0.25 : undefined,
                      ease: exitingCardId === cardId ? 'easeOut' :
                            slidingUp ? 'easeInOut' : undefined,
                      delay: isAnimationComplete && !draggingCardId && !exitingCardId && !slidingUp ? index * 0.1 : 0
                    }
                  }}
                  onAnimationComplete={() => {
                    if (!prefersReducedMotion && index === orderedSubmissions.length - 1 && !isAnimationComplete) {
                      if (isMountedRef.current) setIsAnimationComplete(true);
                    }
                  }}
                  onClick={() => index === 0 ? handleCardClick(submission.cardText, index) : undefined}
                  onTouchStart={(e) => index === 0 ? handleTouchStart(e, index) : undefined}
                  onTouchMove={(e) => index === 0 ? handleTouchMove(e, index) : undefined}
                  onTouchEnd={(e) => index === 0 ? handleTouchEnd(e, index) : undefined}
                >
                  <motion.div
                    className="relative w-full h-full [transform-style:preserve-3d] shadow-lg rounded-xl"
                    initial={{ transform: 'rotateX(0deg)' }}
                    animate={{ transform: isAnimationComplete ? 'rotateX(180deg)' : 'rotateX(0deg)' }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
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
                        sizes="320px"
                      />
                    </div>
                    
                    {/* Card Front */}
                    <div className={cn(
                        "absolute w-full h-full [backface-visibility:hidden] [transform:rotateX(180deg)] rounded-xl overflow-hidden"
                    )}>
                      <Image
                        src="/ui/mit-card-front.png"
                        alt="Response Card Front"
                        fill
                        className="object-cover"
                        data-ai-hint="card front"
                        sizes="320px"
                      />
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 p-6 text-center">
                        <span className="font-im-fell text-black text-2xl leading-none px-4 flex-grow flex items-center">{submission.cardText}</span>
                        {isSelected && isAnimationComplete && (
                          <div className="flex-shrink-0 py-2" style={{ transform: 'translateZ(20px)'}}>
                            <button
                              type="button"
                              className="bg-transparent border-none p-0 group"
                              onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleWinnerSubmit(submission.cardText);
                              }}
                              disabled={!!pendingWinnerCard}
                            >
                              {isPending ? (
                                <div className="h-[45px] w-[137px] flex items-center justify-center">
                                  <Loader2 className="h-6 w-6 animate-spin text-black" />
                                </div>
                              ) : (
                                <Image
                                  src="/ui/crown-winner-button-v1.png"
                                  alt="Crown Winner"
                                  width={137}
                                  height={45}
                                  className="object-contain drop-shadow-lg transition-transform group-hover:scale-105"
                                  data-ai-hint="crown winner button"
                                  sizes="30vw"
                                  priority
                                />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {isBoondoggleRound && (
        <div className="space-y-4">
            <ScenarioDisplay scenario={gameState.currentScenario} isBoondoggle={true} />
            <Card>
                <CardHeader>
                    <CardTitle>Award a Point</CardTitle>
                    <CardDescription>Observe the players and award a point to the best performer.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {gameState.players.filter(p => p.id !== judge.id).map(player => (
                        <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <span className="font-semibold">{player.name}</span>
                            <Button
                                size="sm"
                                onClick={() => handleAwardBoondogglePoint(player.id)}
                                disabled={isPendingBoondoggle}
                            >
                                {isPendingBoondoggle ? <Loader2 className="animate-spin" /> : <Award />}
                                Award
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <div className="text-center mt-2 flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsRulesModalOpen(true)}>
                    <HelpCircle className="mr-2 h-4 w-4" /> Rules
                </Button>
                <Button variant="outline" size="sm" onClick={handleSkipBoondoggle} disabled={isPendingSkip}>
                    {isPendingSkip ? <Loader2 className="animate-spin" /> : <SkipForward />}
                    Skip Boondoggle
                </Button>
            </div>
        </div>
      )}
      
      {gameState.gamePhase === 'judge_approval_pending' && (
         <>
          <AnimatePresence mode="wait">
            {gameState.currentScenario && (
              <ScenarioDisplay
                key={gameState.currentScenario.id || 'scenario-approval-judge'}
                scenario={gameState.currentScenario}
                {...scenarioAnimationProps}
              />
            )}
          </AnimatePresence>
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
        <AlertDialogContent className="border-2 border-primary rounded-xl bg-background shadow-xl p-0">
          <AlertDialogHeader className="bg-primary text-primary-foreground p-6 rounded-t-lg">
            <AlertDialogTitle className="text-3xl font-bold">Approve Custom Card?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-6 space-y-3 text-sm text-muted-foreground">
            <p>
              The winning card was a custom submission by <strong className="text-foreground">{lastRoundWinnerForModal?.name || 'Unknown Player'}</strong>:
            </p>
            <blockquote className="my-1 p-3 border bg-muted rounded-md text-foreground text-base">
              "{lastRoundCardTextForModal || 'Error: Card text missing'}"
            </blockquote>
            <p>
              Do you want to add this card to the game's main deck permanently?
            </p>
          </div>
          <AlertDialogFooter className="p-6 bg-muted/50 rounded-b-lg">
            <Button
                variant="outline"
                onClick={() => handleApprovalDecision(false)}
                disabled={isPendingApproval}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
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

      <PureMorphingModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        variant="settings"
        icon="❓"
        title="Boondoggle Rules"
      >
        <BoondoggleRulesContent />
      </PureMorphingModal>
    </div>
  );
}

    