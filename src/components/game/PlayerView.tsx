
"use client";

import type { GameClientState, PlayerClientState, PlayerHandCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { Send, Loader2, ListCollapse, VenetianMask, Gavel, Edit3, CheckSquare, Sparkles, PartyPopper, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAudio } from '@/contexts/AudioContext';
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
  const { playSfx } = useAudio();
  const isMountedRef = useRef(true);

  // Animation state
  const [scenarioVisible, setScenarioVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(0);
  const [cardsFlipped, setCardsFlipped] = useState(0);
  const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(new Set());
  
  // Touch handling for swipe detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const swipeOccurredRef = useRef(false);
  
  // Drag state for visual feedback
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  
  // Upward drag state for submission
  const [isDraggingUp, setIsDraggingUp] = useState(false);
  const [draggingUpCardId, setDraggingUpCardId] = useState<string | null>(null);
  
  // Card submission animation state
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [submittingCardId, setSubmittingCardId] = useState<string | null>(null);
  const [submissionStartPosition, setSubmissionStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [submissionVelocity, setSubmissionVelocity] = useState<{ x: number; y: number } | null>(null);
  
  // Animation sequence state
  const [exitingCardId, setExitingCardId] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<'left' | 'right'>('right');
  const [slidingUp, setSlidingUp] = useState(false);
  
  // Card order state for shuffling
  const [cardOrder, setCardOrder] = useState<string[]>([]);

  const hasSubmittedThisRound = useMemo(() => 
    gameState.submissions.some(sub => sub.playerId === player.id),
    [gameState.submissions, player.id]
  );

  const isBoondoggleRound = gameState.currentScenario?.category === "Boondoggles" && gameState.gamePhase === 'judging';

  // Play devil laughter sound when boondoggle is revealed
  useEffect(() => {
    if (isBoondoggleRound) {
      playSfx('boondoggle');
    }
  }, [isBoondoggleRound, playSfx]);
  
  const handWithCustomCard = useMemo(() => {
    // Sort the hand so the 'new' card is first, which will render it on top of the stack.
    const sortedHand = [...(player.hand || [])].sort((a, b) => {
      if (a.isNew && !b.isNew) return -1; // a (new card) comes before b
      if (!a.isNew && b.isNew) return 1; // b (new card) comes before a
      return 0;
    });

    const customCard = { id: CUSTOM_CARD_ID, text: customCardText, isCustom: true, isNew: false };
    const baseCards = [...sortedHand, customCard];
    
    // If cardOrder is empty or doesn't match current cards, initialize it
    const cardIds = baseCards.map(c => c.id);
    if (cardOrder.length !== cardIds.length || !cardIds.every(id => cardOrder.includes(id))) {
      setCardOrder(cardIds);
      return baseCards;
    }
    
    // Return cards in the current shuffled order
    return cardOrder.map(id => baseCards.find(card => card.id === id)).filter(Boolean) as typeof baseCards;
  }, [player.hand, customCardText, cardOrder]);

  // Animation Trigger
  useEffect(() => {
    isMountedRef.current = true;
    let timers: NodeJS.Timeout[] = [];

    const startAnimation = () => {
      setIsAnimating(true);
      setScenarioVisible(false);
      setCardsVisible(0);
      setCardsFlipped(0);
      setFlippedCardIds(new Set());
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
        // Play the card deal sound once at the start of the flip sequence
        playSfx('card-flip');
        
        handWithCustomCard.forEach((card, index) => {
          timers.push(setTimeout(() => {
            if (isMountedRef.current) {
              setCardsFlipped(prev => prev + 1);
              setFlippedCardIds(prev => new Set(prev).add(card.id));
            }
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
      // Clean up submission animation state when phase changes or submission completes
      setIsSubmittingCard(false);
      setSubmittingCardId(null);
      setSubmissionStartPosition(null);
      setSubmissionVelocity(null);
    }

    return () => {
      isMountedRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, [gameState.gamePhase, gameState.currentRound, hasSubmittedThisRound, handWithCustomCard.length]);


  const handleCardClick = (cardId: string) => {
    console.log('Card clicked:', cardId, 'Current selected:', selectedCardId);
    // Only block clicks during shuffle animations, not during initial card dealing
    const isShuffleAnimating = exitingCardId !== null || slidingUp;
    if (isShuffleAnimating || hasSubmittedThisRound || swipeOccurredRef.current) return;
    
    // Only allow selection for custom card - regular cards don't need selection anymore
    if (cardId === CUSTOM_CARD_ID) {
      setSelectedCardId(selectedCardId === cardId ? null : cardId);
    }
  };

  // Shuffle function with improved sequenced animations
  const shuffleCard = (cardId: string, direction: 'left' | 'right' = 'right') => {
    console.log('shuffleCard called with:', cardId, direction);
    const isShuffleAnimating = exitingCardId !== null || slidingUp;
    console.log('Shuffle animation check:', { isShuffleAnimating, exitingCardId, slidingUp, hasSubmittedThisRound });
    
    if (isShuffleAnimating || hasSubmittedThisRound) {
      console.log('Shuffle blocked - returning early');
      return;
    }
    
    console.log('Starting shuffle animation');
    
    // Clear selection if the card being shuffled is currently selected
    if (selectedCardId === cardId) {
      console.log('Clearing selection for swiped card:', cardId);
      setSelectedCardId(null);
    }
    
    setIsAnimating(true);
    
    // Step 1: Card slides away (300ms)
    setExitingCardId(cardId);
    setExitDirection(direction);
    
    setTimeout(() => {
      // Step 2: Immediately update card order while cards are still sliding
      setCardOrder(prevOrder => {
        const newOrder = [...prevOrder];
        const cardIndex = newOrder.indexOf(cardId);
        if (cardIndex !== -1) {
          const [card] = newOrder.splice(cardIndex, 1);
          newOrder.push(card);
        }
        return newOrder;
      });
      
      // Step 3: Other cards slide up to fill gap (400ms)
      setSlidingUp(true);
      
      setTimeout(() => {
        // Step 4: Reset animation states
        setExitingCardId(null);
        setSlidingUp(false);
        setIsAnimating(false);
      }, 250); // Further reduced slide up duration for responsiveness
    }, 300); // Card exit duration
  };

  // Touch event handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent, cardId: string) => {
    // Note: Can't preventDefault in React touch events due to passive listeners
    // Will handle scroll prevention via CSS instead
    const touch = e.touches[0];
    swipeOccurredRef.current = false;
    setDraggingCardId(cardId);
    setDragOffset({ x: 0, y: 0 });
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchMove = (e: React.TouchEvent, cardId: string) => {
    if (!touchStartRef.current || draggingCardId !== cardId) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // Use natural Y-axis direction (down is positive)
    setDragOffset({ x: deltaX, y: deltaY });
    
    // Check for upward movement (negative deltaY = upward)
    const isMovingUp = deltaY < -20; // 20px threshold to start showing submission hint
    const wasMovingUp = isDraggingUp;
    
    if (isMovingUp && !wasMovingUp) {
      console.log('Started dragging up for submission:', cardId);
      setIsDraggingUp(true);
      setDraggingUpCardId(cardId);
    } else if (!isMovingUp && wasMovingUp) {
      console.log('Stopped dragging up:', cardId);
      setIsDraggingUp(false);
      setDraggingUpCardId(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, cardId: string) => {
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
    const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
    
    if ((distance > minDistance || velocity > minVelocity)) {
      if (isHorizontal) {
        const direction = deltaX > 0 ? 'right' : 'left';
        console.log(`Swipe detected: ${direction} on card ${cardId}`, { deltaX, deltaY, distance, velocity });
        console.log('Calling shuffleCard with:', cardId, direction);
        swipeOccurredRef.current = true;
        shuffleCard(cardId, direction);
      } else if (isVertical && deltaY < 0) {
        // Upward swipe - check submission thresholds
        const upwardDistance = Math.abs(deltaY);
        const upwardVelocity = upwardDistance / deltaTime;
        
        // Two ways to submit:
        // 1. Quick flick: 40px distance AND 0.4px/ms velocity (both required)
        // 2. Deliberate drag: reached 30% of screen height
        const flickThreshold = upwardDistance > 40 && upwardVelocity > 0.4;
        const dragThreshold = upwardDistance > window.innerHeight * 0.3; // 30% of screen height
        
        if (flickThreshold || dragThreshold) {
          console.log(`Swipe up to submit detected on card ${cardId}`, { 
            deltaY, upwardDistance, upwardVelocity, flickThreshold, dragThreshold 
          });
          swipeOccurredRef.current = true;
          
          // Capture current position and velocity for smooth transition
          const currentPosition = dragOffset || { x: 0, y: 0 };
          const velocity = { x: deltaX / deltaTime, y: deltaY / deltaTime };
          
          // Start submission animation with momentum
          setSubmissionStartPosition(currentPosition);
          setSubmissionVelocity(velocity);
          setIsSubmittingCard(true);
          setSubmittingCardId(cardId);
          handleSwipeUpSubmit(cardId, currentPosition, velocity);
          
          // Don't reset drag states here - let the animation handle it
          return;
        } else {
          console.log(`Swipe up detected but below threshold:`, { upwardDistance, upwardVelocity });
        }
      }
    }
    
    // Reset drag state
    setDragOffset(null);
    setDraggingCardId(null);
    setIsDraggingUp(false);
    setDraggingUpCardId(null);
    
    // Reset swipe flag after a short delay to allow click prevention
    setTimeout(() => {
      swipeOccurredRef.current = false;
    }, 100);
    
    touchStartRef.current = null;
  };

  // Handle swipe up to submit
  const handleSwipeUpSubmit = (cardId: string, startPosition?: { x: number; y: number }, velocity?: { x: number; y: number }) => {
    console.log('handleSwipeUpSubmit called for card:', cardId, { startPosition, velocity });
    
    if (hasSubmittedThisRound) {
      console.log('Already submitted this round');
      return;
    }

    playSfx('card-submit');

    const selectedCardData = handWithCustomCard.find(c => c.id === cardId);
    if (!selectedCardData) {
      console.log('Card not found:', cardId);
      return;
    }

    const isCustom = selectedCardData.id === CUSTOM_CARD_ID;
    const textToSubmit = isCustom ? customCardText : selectedCardData.text;

    if (!textToSubmit.trim()) {
      toast({ title: "Empty card?", description: "Your card needs some text!", variant: "destructive" });
      // Reset submission state on validation error
      setIsSubmittingCard(false);
      setSubmittingCardId(null);
      setSubmissionStartPosition(null);
      setSubmissionVelocity(null);
      return;
    }

    console.log('Starting card fly animation for submission:', { cardId, isCustom, textToSubmit });

    // Clean up drag states smoothly - no artificial delay
    setDragOffset(null);
    setDraggingCardId(null);
    setIsDraggingUp(false);
    setDraggingUpCardId(null);

    // Calculate dynamic animation duration based on velocity
    const baseVelocity = velocity ? Math.abs(velocity.y) : 0;
    const minDuration = 300;
    const maxDuration = 600;
    // Higher velocity = shorter duration (feels more responsive)
    const dynamicDuration = Math.max(minDuration, maxDuration - (baseVelocity * 200));

    // Start the card fly animation - submission happens after animation completes
    setTimeout(() => {
      console.log('Card animation complete, submitting response');
      
      startTransition(async () => {
        try {
          await submitResponse(player.id, textToSubmit, gameState.gameId, gameState.currentRound, isCustom);
          if (isMountedRef.current) {
            setCustomCardText('');
            // DON'T reset submission animation state after successful submission
            // Let the card stay "gone" - it will be cleaned up when the game phase changes
            console.log('Submission successful, card stays gone');
          }
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({ title: "Submission Error", description: error.message || "Failed to submit response.", variant: "destructive" });
            // Only reset submission state on error so card reappears
            setIsSubmittingCard(false);
            setSubmittingCardId(null);
            setSubmissionStartPosition(null);
            setSubmissionVelocity(null);
          }
        }
      });
    }, dynamicDuration);
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
          <Image
            src="/backgrounds/boondoggle-poster.png"
            alt="A Boondoggle is afoot!"
            width={300}
            height={300}
            className="object-contain mx-auto"
            priority
            data-ai-hint="boondoggle poster"
          />
          <p className="text-muted-foreground mt-4 text-lg">
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
              isBoondoggle={isBoondoggleRound}
              showSubmissionPrompt={isDraggingUp}
              {...scenarioAnimationProps}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="relative min-h-[450px] [perspective:1000px]"
        style={{
          touchAction: draggingCardId ? 'none' : 'pan-y'
        }}
      >
        {hasSubmittedThisRound && !isBoondoggleRound ? (
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
        ) : !isBoondoggleRound ? (
          handWithCustomCard.map((card, index) => {
            const isVisible = index < cardsVisible;
            const isFlipped = flippedCardIds.has(card.id);
            const isThisCardSelected = selectedCardId === card.id;

            return (
              <motion.div
                key={`${card.id}-${player.id}`}
                className={`absolute w-[22rem] left-0 right-0 mx-auto [transform-style:preserve-3d] aspect-[1536/600] ${index === 0 ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                  top: 20 + (index * 35),
                  zIndex: isThisCardSelected ? 50 : 20 - index,
                  touchAction: index === 0 ? 'none' : 'auto'
                }}
                transition={{ 
                  type: slidingUp ? 'tween' : 'spring', 
                  stiffness: 400, 
                  damping: 30,
                  duration: slidingUp ? 0.5 : undefined,
                  ease: slidingUp ? 'linear' : undefined
                }}
                onClick={() => index === 0 ? handleCardClick(card.id) : undefined}
                onTouchStart={(e) => index === 0 ? handleTouchStart(e, card.id) : undefined}
                onTouchMove={(e) => index === 0 ? handleTouchMove(e, card.id) : undefined}
                onTouchEnd={(e) => index === 0 ? handleTouchEnd(e, card.id) : undefined}
              >
                <motion.div
                  className="relative w-full h-full [transform-style:preserve-3d] shadow-lg rounded-xl"
                  initial={{ 
                    y: 300, 
                    scale: 0.8, 
                    rotateX: 0,
                    x: 0
                  }}
                  animate={{
                    // Base position and visibility
                    y: isVisible ? 0 : 300,
                    scale: isVisible ? 1 : 0.8,
                    
                    // Card selection state
                    ...(isThisCardSelected && {
                      y: (isVisible ? 0 : 300) - 20,
                      scale: (isVisible ? 1 : 0.8) * 1.05
                    }),
                    
                    // Card flip state
                    rotateX: isFlipped ? 180 : 0,
                    
                    // Drag state (immediate, no transition)
                    ...(draggingCardId === card.id && dragOffset && {
                      x: dragOffset.x,
                      y: (isVisible ? 0 : 300) + (isThisCardSelected ? -20 : 0) + dragOffset.y
                    }),
                    
                    // Exit animation for shuffle
                    ...(exitingCardId === card.id && {
                      x: exitDirection === 'right' ? window.innerWidth : -window.innerWidth
                    }),
                    
                    // Slide up animation during shuffle
                    ...(slidingUp && index > 0 && card.id !== exitingCardId && {
                      y: (isVisible ? 0 : 300) + (isThisCardSelected ? -20 : 0) - 35
                    }),
                    
                    // Submission fly-away animation (overrides everything else)
                    ...(submittingCardId === card.id && (() => {
                      const startPos = submissionStartPosition || { x: 0, y: 0 };
                      const velocity = submissionVelocity || { x: 0, y: 0 };
                      
                      // Use momentum for more natural trajectory
                      const momentumX = velocity.x * 100; // Scale velocity for visual effect
                      const momentumBoost = Math.abs(velocity.y) * 50; // Extra upward boost from velocity
                      
                      return {
                        y: startPos.y - window.innerHeight * 0.8 - momentumBoost,
                        x: startPos.x + momentumX * 0.3, // Slight horizontal drift based on momentum
                        scale: 0.6, // Shrink more for dramatic effect
                        opacity: 0,
                        rotateZ: velocity.x > 0 ? 8 : -8, // Rotate based on horizontal momentum
                      };
                    })()),
                    
                    boxShadow: isThisCardSelected
                      ? '0 15px 40px rgba(52, 152, 219, 0.4)'
                      : '0 6px 20px rgba(0,0,0,0.15)',
                  }}
                  transition={{ 
                    duration: draggingCardId === card.id ? 0 : 
                             submittingCardId === card.id ? (() => {
                               const baseVelocity = submissionVelocity ? Math.abs(submissionVelocity.y) : 0;
                               const minDuration = 0.3;
                               const maxDuration = 0.6;
                               return Math.max(minDuration, maxDuration - (baseVelocity * 0.2));
                             })() :
                             exitingCardId === card.id ? 0.3 :
                             slidingUp ? 0.25 : 0.6, 
                    ease: submittingCardId === card.id ? [0.15, 0.8, 0.25, 1] : // More natural spring-like easing
                          exitingCardId === card.id ? 'easeOut' :
                          slidingUp ? 'easeInOut' : [0.68, -0.55, 0.265, 1.55]
                  }}
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
                              onClick={(e) => {
                                console.log('Custom card textarea clicked, current selected:', selectedCardId);
                                e.stopPropagation();
                                // Auto-select custom card when textarea is clicked
                                if (selectedCardId !== CUSTOM_CARD_ID) {
                                  console.log('Auto-selecting custom card');
                                  setSelectedCardId(CUSTOM_CARD_ID);
                                }
                              }}
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
        ) : null}
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
