
"use client";

import type { GameClientState, PlayerClientState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useTransition, useEffect, useRef } from 'react';
import { Gavel, Send, CheckCircle, Loader2, Crown, PlusCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ScenarioDisplay from './ScenarioDisplay';
import { cn } from '@/lib/utils';
import { handleJudgeApprovalForCustomCard } from '@/app/game/actions';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import SwipeableCategorySelector from './SwipeableCategorySelector';

interface JudgeViewProps {
  gameState: GameClientState;
  judge: PlayerClientState;
  onSelectCategory: (category: string) => Promise<void>;
  onSelectWinner: (cardText: string) => Promise<void>;
}

export default function JudgeView({ gameState, judge, onSelectCategory, onSelectWinner }: JudgeViewProps) {
  const [selectedWinningCard, setSelectedWinningCard] = useState<string>('');
  const [pendingWinnerCard, setPendingWinnerCard] = useState<string>('');
  const [isPendingCategory, startTransitionCategory] = useTransition();
  const [isPendingApproval, startTransitionApproval] = useTransition();
  const { toast } = useToast();
  
  const [shuffledSubmissions, setShuffledSubmissions] = useState<GameClientState['submissions']>([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const isMountedRef = useRef(true);
  const prefersReducedMotion = useReducedMotion();

  const showApprovalModal = gameState.gamePhase === 'judge_approval_pending' && gameState.currentJudgeId === judge.id;
  
  useEffect(() => {
    isMountedRef.current = true;
    
    if (gameState.gamePhase === 'judging' && !isAnimationComplete) {
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
  }, [gameState.gamePhase, gameState.submissions, isAnimationComplete, prefersReducedMotion, shuffledSubmissions.length]);
  
  const handleUnleashScenario = (category: string) => {
    if (!category) {
      toast({ title: "Hold up!", description: "Please select a category first.", variant: "destructive" });
      return;
    }
    startTransitionCategory(async () => {
      await onSelectCategory(category);
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
  
  const handleCardClick = (cardText: string) => {
    if (!isAnimationComplete || !!pendingWinnerCard) {
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
      
      {gameState.gamePhase === 'judging' && (
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
          
          <div className="relative mt-12 min-h-[450px] [perspective:1000px]">
            {shuffledSubmissions.map((submission, index) => {
              const isSelected = selectedWinningCard === submission.cardText;
              const isPending = pendingWinnerCard === submission.cardText;
              
              return (
                <motion.div
                  key={submission.playerId}
                  className="absolute w-full max-w-sm mx-auto left-0 right-0 cursor-pointer [transform-style:preserve-3d] aspect-[1536/600]"
                  style={{
                    top: 20 + (index * 35),
                    zIndex: isSelected ? 50 : 20 - index,
                  }}
                   animate={{
                    y: isAnimationComplete ? index * 75 : index * 30,
                    scale: isAnimationComplete && isSelected ? 1.1 : (isAnimationComplete ? 1 : 1 - (shuffledSubmissions.length - 1 - index) * 0.05),
                    transition: { type: 'spring', stiffness: 100, damping: 15, delay: isAnimationComplete ? index * 0.1 : 0 }
                  }}
                  onAnimationComplete={() => {
                    if (!prefersReducedMotion && index === shuffledSubmissions.length - 1) {
                      if (isMountedRef.current) setIsAnimationComplete(true);
                    }
                  }}
                  onClick={() => handleCardClick(submission.cardText)}
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
    </div>
  );
}
