
"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  selectCategory,
  selectWinner,
  nextRound,
  getCurrentPlayer,
  resetGameForTesting
} from '@/app/game/actions';
import type { PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { ACTIVE_PLAYING_PHASES } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import GameOverDisplay from '@/components/game/GameOverDisplay';
import RecapSequenceDisplay from '@/components/game/RecapSequenceDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Loader2, RefreshCw, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { PureMorphingModal } from '@/components/PureMorphingModal';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import GameUI from '@/components/game/GameUI';
import { useAudio } from '@/contexts/AudioContext';
import { useLoading } from '@/contexts/LoadingContext';
import { useTargetedGameSubscription } from '@/hooks/useTargetedGameSubscription';
import { getGame } from '@/app/game/actions';

export default function GamePage() {
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);
  const { internalGameState, setInternalGameState, thisPlayer, setThisPlayer } = useTargetedGameSubscription(thisPlayerId);
  
  const gameStateRef = useRef(internalGameState);
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoading();
  const isMountedRef = useRef(true);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  
  const { playTrack, stop: stopMusic, state: audioState, toggleMute, playSfx } = useAudio();

  useEffect(() => {
    gameStateRef.current = internalGameState;
  }, [internalGameState]);

  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    try {
      const initialGameState = await getGame();
      if (!isMountedRef.current) return;

      if (!initialGameState || !initialGameState.gameId) {
        toast({ title: "Game Not Found", description: "Could not find an active game session.", variant: "destructive" });
        router.push('/?step=setup');
        return;
      }

      setInternalGameState(initialGameState);

      const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${initialGameState.gameId}`);
      
      if (!playerIdFromStorage) {
        if (ACTIVE_PLAYING_PHASES.includes(initialGameState.gamePhase as GamePhaseClientState)) {
          setThisPlayer(null); // Set as spectator
        } else {
          router.push('/?step=setup');
        }
      } else {
        setThisPlayerId(playerIdFromStorage);
        const playerDetails = await getCurrentPlayer(playerIdFromStorage, initialGameState.gameId);
        if (playerDetails) {
            setThisPlayer(playerDetails);
        } else {
          localStorage.removeItem(`thisPlayerId_game_${initialGameState.gameId}`);
          router.push('/?step=setup'); // Player ID exists but isn't in game, so redirect
        }
      }
      

    } catch (error: any) {
      console.error(`GamePage: Error in fetchGameAndPlayer (from ${origin}):`, error);
      toast({ title: "Error Loading Game", description: "Could not fetch game data.", variant: "destructive" });
    } finally {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
    }
  }, [router, toast, setInternalGameState, setThisPlayer]);
  

  useEffect(() => {
    isMountedRef.current = true;
    fetchGameAndPlayer("initial mount");
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchGameAndPlayer]);

  // Handle transition states from database
  useEffect(() => {
    if (!internalGameState) return;

    if (internalGameState.transitionState !== 'idle') {
       showLoader(internalGameState.transitionState, {
          message: internalGameState.transitionMessage || 'Loading...',
          players: internalGameState.players
        });
    } else {
        hideLoader();
    }
  }, [internalGameState?.transitionState, internalGameState?.transitionMessage, internalGameState?.players, showLoader, hideLoader]);

  // Audio management
  useEffect(() => {
    if (internalGameState) {
      if (internalGameState.gamePhase === 'game_over') {
        playTrack('lobby-music');
      } else if (ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase) || internalGameState.gamePhase === 'winner_announcement') {
        playTrack('game-music');
      } else {
        playTrack('lobby-music');
      }
    }
    
    // On unmount, stop music
    return () => {
        stopMusic();
    }
  }, [internalGameState?.gamePhase, playTrack, stopMusic]);

  const handleNextRound = useCallback(async () => {
    const gameId = gameStateRef.current?.gameId;
    if (gameId) {
      try {
        await nextRound(gameId);
      } catch (error: any) {
        if (isMountedRef.current) {
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      }
    }
  }, [toast]);

  const handleSelectCategory = async (category: string) => {
    if (internalGameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectCategory(internalGameState.gameId, category);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
          }
        }
      });
    }
  };

  const handleSelectWinner = async (winningCardText: string, boondoggleWinnerId?: string) => {
    if (internalGameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectWinner(internalGameState.gameId, winningCardText, boondoggleWinnerId);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
          }
        }
      });
    }
  };

  const handlePlayAgainYes = async () => {
    if (internalGameState?.gameId) {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          // Let the redirect happen
        } else {
          if (isMountedRef.current) {
            toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
          }
        }
      }
    }
  };

  const handlePlayAgainNo = () => {
    router.push('/');
  };

  const handleResetGameFromGamePage = async () => {
    startActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
        } else {
          if (isMountedRef.current) {
            toast({
              title: "Reset Failed",
              description: `Could not reset the game. ${error.message || String(error)}`,
              variant: "destructive",
            });
          }
        }
      }
    });
  };


  if (isInitialLoading) {
    return (
       <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
         <Loader2 className="h-12 w-12 animate-spin text-primary-foreground mb-4" />
         <p className="text-lg text-primary-foreground font-semibold">Loading Game...</p>
       </div>
    );
  }

  if (!internalGameState || !internalGameState.gameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="/ui/new-logo.png" alt="Game Logo - Error" width={100} height={100} className="mb-6 opacity-70" data-ai-hint="game logo"/>
        <h1 className="text-4xl font-bold text-destructive mb-4">Critical Game Error!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Could not load or initialize the game session. Please try again or reset.
        </p>
        <Link href="/?step=setup">
          <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Lobby Setup
          </Button>
        </Link>
      </div>
    );
  }

  if (!thisPlayer && ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase as GamePhaseClientState)) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
              <Image src="/ui/new-logo.png" alt="Game in Progress" width={100} height={100} className="mb-6" data-ai-hint="game logo"/>
              <h1 className="text-4xl font-bold text-primary mb-4">Game in Progress</h1>
              <p className="text-lg text-muted-foreground mb-8">
                  This game has already started. You can watch, but you can't join until it's over.
              </p>
              <div className="w-full max-w-sm my-6">
                <Scoreboard players={internalGameState.players} currentJudgeId={internalGameState.currentJudgeId} />
              </div>
              <Button onClick={handleResetGameFromGamePage} variant="outline" size="lg" disabled={isActionPending}>
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Reset Game (For Testing)
              </Button>
          </div>
      );
  }

  if (internalGameState.gamePhase === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="/ui/new-logo.png" alt="Game Logo - Lobby" width={100} height={100} className="mb-6" data-ai-hint="game logo"/>
        <h1 className="text-4xl font-bold text-primary mb-4">Game Has Returned to Lobby</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The game session has been reset or ended.
        </p>
          <Link href="/?step=setup" className="mt-6">
            <Button variant="default" size="lg">
                Go to Player Setup & Lobby
            </Button>
        </Link>
      </div>
    );
  }

  if (!thisPlayer && (internalGameState.gamePhase !== 'winner_announcement' && internalGameState.gamePhase !== 'game_over')) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl text-muted-foreground">Identifying player...</p>
          <p className="text-sm mt-2">If this persists, you might not be part of this game or try returning to the lobby.</p>
           <Link href="/?step=setup" className="mt-4">
            <Button variant="outline">Go to Lobby</Button>
          </Link>
        </div>
     );
  }

  const showRecap = internalGameState.gamePhase === 'winner_announcement' && internalGameState.lastWinner;

  const renderGameContent = () => {
    if (!thisPlayer && (internalGameState.gamePhase !== 'winner_announcement' && internalGameState.gamePhase !== 'game_over')) {
        if (ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase)) {
            return (
                <Card className="text-center">
                    <CardHeader><CardTitle className="text-destructive">Player Identification Error</CardTitle></CardHeader>
                    <CardContent><p>Could not identify your player profile for this active game. Please try returning to the lobby.</p></CardContent>
                </Card>
            );
        }
    }

    if (internalGameState.gamePhase === 'game_over') {
      return <GameOverDisplay
                gameState={internalGameState}
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }

    if (internalGameState.gamePhase === 'lobby') { 
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-semibold mb-4">Game is in Lobby</h2>
                <p className="mb-4">The game has returned to the lobby. Please go to player setup.</p>
                <Link href="/?step=setup">
                    <Button>Go to Lobby Setup</Button>
                </Link>
            </div>
        );
    }
    
    if (showRecap) {
      return null;
    }

    if (thisPlayer?.isJudge) {
      return <JudgeView gameState={internalGameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    
    if (thisPlayer && !thisPlayer.isJudge) {
      return <PlayerView gameState={internalGameState} player={thisPlayer} />;
    }
    
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Waiting for Game State</CardTitle></CardHeader>
            <CardContent><p>The game is in phase: {internalGameState.gamePhase}. Your role is being determined or an issue occurred.</p></CardContent>
        </Card>
    );
  };

  return (
    <>
      {showRecap && (
        <RecapSequenceDisplay
          lastWinnerPlayer={internalGameState.lastWinner!.player}
          lastWinnerCardText={internalGameState.lastWinner!.cardText}
          players={internalGameState.players}
          currentJudgeId={internalGameState.currentJudgeId}
          thisPlayerIsJudge={thisPlayer?.isJudge ?? false}
          onNextRound={handleNextRound}
        />
      )}
      
      <div className={`flex flex-col md:flex-row gap-4 md:gap-8 py-4 md:py-8 ${showRecap ? 'opacity-20 pointer-events-none' : ''}`}>
        <main className="flex-grow w-full md:w-full lg:w-full relative order-1 md:order-2">
          {renderGameContent()}
        </main>
      </div>
      
      <GameUI
        gameState={internalGameState}
        thisPlayer={thisPlayer}
        onScoresClick={() => setIsScoreboardOpen(true)}
        onMenuClick={() => setIsMenuModalOpen(true)}
      />
      
      {/* Scoreboard Modal */}
      <PureMorphingModal
        isOpen={isScoreboardOpen}
        onClose={() => setIsScoreboardOpen(false)}
        variant="image"
        className="p-0 w-auto h-auto max-w-md bg-transparent"
      >
        <div className="relative">
          <Image
            src="/backgrounds/scoreboard-poster.png"
            alt="Leaderboard"
            width={512}
            height={768}
            className="object-contain"
            priority
            data-ai-hint="scoreboard poster"
          />
          <div className="absolute left-[10%] right-[10%] bottom-[15%]" style={{ top: '45%' }}>
            <Scoreboard
              players={internalGameState.players}
              currentJudgeId={internalGameState.currentJudgeId}
            />
          </div>
        </div>
      </PureMorphingModal>

      <PureMorphingModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        variant="settings"
        icon="⚙️"
        title="Game Menu"
      >
        <div className="text-white/90 mb-5">
          Options and actions for the game.
        </div>
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={toggleMute}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {audioState.isMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {audioState.isMuted ? 'Unmute Audio' : 'Mute Audio'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setIsMenuModalOpen(false);
              setIsHowToPlayModalOpen(true);
            }}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <HelpCircle className="mr-2 h-4 w-4" /> How to Play
          </Button>
          <Link href="/?step=setup" className="inline-block" onClick={() => setIsMenuModalOpen(false)}>
            <Button variant="outline" className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30">
              <Home className="mr-2 h-4 w-4" /> Exit to Lobby
            </Button>
          </Link>
          <Button
            onClick={() => {
              handleResetGameFromGamePage();
              setIsMenuModalOpen(false);
            }}
            className="bg-red-500/80 hover:bg-red-600/80 text-white"
            disabled={isActionPending}
          >
            {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reset Game (Testing)
          </Button>
        </div>
      </PureMorphingModal>

      <PureMorphingModal
        isOpen={isHowToPlayModalOpen}
        onClose={() => setIsHowToPlayModalOpen(false)}
        variant="default"
        icon="❓"
        title="How to Play"
      >
        <HowToPlayModalContent />
      </PureMorphingModal>

    </>
  );
}

export const dynamic = 'force-dynamic';

    