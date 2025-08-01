
"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  selectCategory,
  selectWinner,
  nextRound,
  resetGameForTesting
} from '@/app/game/actions';
import PinCodeModal from '@/components/PinCodeModal';
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
import { Home, Play, Loader2, RefreshCw, HelpCircle, Volume2, VolumeX, Music, Zap } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { PureMorphingModal } from '@/components/PureMorphingModal';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import GameUI from '@/components/game/GameUI';
import { useAudio } from '@/contexts/AudioContext';
import { useSharedGame } from '@/contexts/SharedGameContext';
import { useLoading } from '@/contexts/LoadingContext';
import FullScreenLoader from '@/components/ui/FullScreenLoader';



export default function GamePage() {
  const [isActionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const { playTrack, stop: stopMusic, state: audioState, toggleMute, toggleMusicMute, toggleSfxMute } = useAudio();
  const { gameState: internalGameState, thisPlayer, isInitializing } = useSharedGame();
  const { setGlobalLoading } = useLoading();


  

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear global loading flag when game page is ready
  useEffect(() => {
    if (!isInitializing && internalGameState) {
      console.log("GAME_PAGE: Game ready, clearing global loading flag");
      setGlobalLoading(false);
    }
  }, [isInitializing, internalGameState, setGlobalLoading]);

  // Audio management
  useEffect(() => {
    if (internalGameState) {
      console.log(`GAME_PAGE: Audio check. Phase: ${internalGameState.gamePhase}. Playing correct track.`);
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
    const gameId = internalGameState?.gameId;
    if (gameId) {
      console.log(`GAME_PAGE: handleNextRound triggered for game ${gameId}`);
      try {
        await nextRound(gameId);
      } catch (error: any) {
        if (isMountedRef.current) {
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      }
    }
  }, [internalGameState?.gameId, toast]);

  const handleSelectCategory = async (category: string) => {
    if (internalGameState?.gameId) {
      console.log(`GAME_PAGE: handleSelectCategory triggered for category: ${category}`);
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
      console.log(`GAME_PAGE: handleSelectWinner triggered. Card: "${winningCardText}", Boondoggle Winner: ${boondoggleWinnerId}`);
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
      console.log("GAME_PAGE: handlePlayAgainYes triggered.");
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
    console.log("GAME_PAGE: handlePlayAgainNo triggered.");
    router.push('/');
  };

  const handleResetGameFromGamePageWithPin = () => {
    setIsPinModalOpen(true);
  };

  const handleResetGameFromGamePage = async () => {
    console.log("GAME_PAGE: handleResetGameFromGamePage triggered.");
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


  // Let UnifiedTransitionOverlay handle the loading display
  // No need for local loader since overlay is global

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
  
  // UnifiedTransitionOverlay handles transition states globally


  if (!thisPlayer && ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase as GamePhaseClientState)) {
      console.log("GAME_PAGE: Rendering spectator view.");
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
              <Button onClick={handleResetGameFromGamePageWithPin} variant="outline" size="lg" disabled={isActionPending}>
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Reset Game (For Testing)
              </Button>
          </div>
      );
  }

  if (internalGameState.gamePhase === 'lobby') {
    console.log("GAME_PAGE: Game has returned to lobby, redirecting.");
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
     console.log("GAME_PAGE: Player not identified yet, showing loading state.");
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
    console.log(`GAME_PAGE: Rendering main content. Show recap: ${showRecap}`);
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
      console.log("GAME_PAGE: Rendering GameOverDisplay.");
      return <GameOverDisplay
                gameState={internalGameState}
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }

    if (internalGameState.gamePhase === 'lobby') { 
        console.log("GAME_PAGE: Rendering lobby redirect content.");
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
      console.log("GAME_PAGE: Rendering JudgeView.");
      return <JudgeView gameState={internalGameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    
    if (thisPlayer && !thisPlayer.isJudge) {
      console.log("GAME_PAGE: Rendering PlayerView.");
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
        <div className="text-black/90 mb-5">
          Options and actions for the game.
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-black/80 text-sm font-medium mb-2">Audio Controls</div>
          <Button
            variant="outline"
            onClick={toggleMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.isMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {audioState.isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleMusicMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.musicMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Music className="mr-2 h-4 w-4" />}
            {audioState.musicMuted ? 'Unmute Music' : 'Mute Music'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleSfxMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.sfxMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
            {audioState.sfxMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setIsMenuModalOpen(false);
              setIsHowToPlayModalOpen(true);
            }}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            <HelpCircle className="mr-2 h-4 w-4" /> How to Play
          </Button>
          <Link href="/?step=setup" className="inline-block" onClick={() => setIsMenuModalOpen(false)}>
            <Button variant="outline" className="w-full bg-black/10 hover:bg-black/20 text-black border-black/30">
              <Home className="mr-2 h-4 w-4" /> Exit to Lobby
            </Button>
          </Link>
          <Button
            onClick={() => {
              setIsMenuModalOpen(false);
              handleResetGameFromGamePageWithPin();
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
        variant="settings"
        icon="❓"
        title="How to Play"
      >
        <HowToPlayModalContent />
      </PureMorphingModal>

      {/* PIN Code Modal */}
      <PinCodeModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handleResetGameFromGamePage}
        title="Enter PIN to Reset Game"
      />

    </>
  );
}

export const dynamic = 'force-dynamic';

    