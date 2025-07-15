"use client";
"use client";

import { useState } from 'react';
import { useEffect, useTransition, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  startGame,
  selectCategory,
  selectWinner,
  nextRound,
  resetGameForTesting
} from '@/app/game/actions';
import type { GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import GameOverDisplay from '@/components/game/GameOverDisplay';
import RecapSequenceDisplay from '@/components/game/RecapSequenceDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, RefreshCw, HelpCircle, Volume2, VolumeX, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import GameUI from '@/components/game/GameUI';
import { useAudio } from '@/contexts/AudioContext';
import { useGameState } from '@/hooks/useGameState';
import { useGameNavigation } from '@/hooks/useGameNavigation';

export default function GamePage() {
  const { gameState, thisPlayer, gameStateRef, thisPlayerRef, fetchGameAndPlayer } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { showLoader, hideLoader } = useLoading();
  const { playTrack, stop: stopMusic, state: audioState, toggleMute } = useAudio();
  
  const [isActionPending, startActionTransition] = useTransition();
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle navigation between pages
  useGameNavigation({
    gameState,
    thisPlayerId: thisPlayer?.id || null,
    currentPath: pathname
  });

  // Initial data fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchGameAndPlayer();
    
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [fetchGameAndPlayer]);

  // Handle transition states from database
  useEffect(() => {
    if (!gameState) return;

    switch (gameState.transitionState) {
      case 'starting_game':
        showLoader('starting_game', {
          message: gameState.transitionMessage || 'Starting the game...',
          players: gameState.players
        });
        break;
      case 'transitioning':
        showLoader('transitioning', {
          message: gameState.transitionMessage || 'Loading...'
        });
        break;
      case 'idle':
        hideLoader();
        break;
    }
  }, [gameState?.transitionState, gameState?.transitionMessage, gameState?.players, showLoader, hideLoader]);

  // Audio management
  useEffect(() => {
    if (gameState) {
      if (gameState.gamePhase === 'game_over') {
        playTrack('lobby-music');
      } else if (ACTIVE_PLAYING_PHASES.includes(gameState.gamePhase) || gameState.gamePhase === 'winner_announcement') {
        playTrack('game-music');
      } else {
        playTrack('lobby-music');
      }
    }
    
    return () => stopMusic();
  }, [gameState?.gamePhase, playTrack, stopMusic]);

  // Real-time subscriptions
  useEffect(() => {
    if (!gameState?.gameId) return;

    const gameId = gameState.gameId;
    const currentPlayerId = thisPlayerRef.current?.id;

    const debouncedFetch = async () => {
      if (!isMountedRef.current) return;
      await fetchGameAndPlayer(gameId, false); // Don't show loading for real-time updates
    };

    const handleRealtimeUpdate = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(debouncedFetch, 300);
    };

    const channelsConfig = [
      { name: 'game-updates', table: 'games', filter: `id=eq.${gameId}`, event: 'UPDATE' },
      { name: 'players-updates', table: 'players', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'player-hands-updates', table: 'player_hands', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'submissions-updates', table: 'responses', filter: `game_id=eq.${gameId}`, event: '*' }
    ];

    const uniqueChannelSuffix = currentPlayerId || Date.now();
    const activeSubscriptions = channelsConfig.map(channelConfig => {
      const channelName = `${channelConfig.name}-${gameId}-${uniqueChannelSuffix}`;
      return supabase
        .channel(channelName)
        .on('postgres_changes', {
            event: channelConfig.event as any,
            schema: 'public',
            table: channelConfig.table,
            filter: channelConfig.filter
          },
          handleRealtimeUpdate
        )
        .subscribe();
    });

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub));
    };
  }, [gameState?.gameId, fetchGameAndPlayer]);

  // Action handlers
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
    if (gameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectCategory(gameState.gameId, category);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
          }
        }
      });
    }
  };

  const handleSelectWinner = async (winningCardText: string) => {
    if (gameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectWinner(winningCardText, gameState.gameId);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
          }
        }
      });
    }
  };

  const handlePlayAgainYes = async () => {
    if (gameState?.gameId) {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (isMountedRef.current) {
          toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
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
        if (isMountedRef.current) {
          toast({
            title: "Reset Failed",
            description: `Could not reset the game. ${error.message || String(error)}`,
            variant: "destructive",
          });
        }
      }
    });
  };

  // Early returns for error states
  if (!gameState?.gameId) {
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

  // Spectator view for users not in active game
  if (!thisPlayer && ACTIVE_PLAYING_PHASES.includes(gameState.gamePhase as GamePhaseClientState)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="/ui/new-logo.png" alt="Game in Progress" width={100} height={100} className="mb-6" data-ai-hint="game logo"/>
        <h1 className="text-4xl font-bold text-primary mb-4">Game in Progress</h1>
        <p className="text-lg text-muted-foreground mb-8">
          This game has already started. You can watch, but you can't join until it's over.
        </p>
        <div className="w-full max-w-sm my-6">
          <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        </div>
        <Button onClick={handleResetGameFromGamePage} variant="outline" size="lg" disabled={isActionPending}>
          {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reset Game (For Testing)
        </Button>
      </div>
    );
  }

  // Game content rendering
  const showRecap = gameState.gamePhase === 'winner_announcement' && gameState.lastWinner;

  const renderGameContent = () => {
    if (gameState.gamePhase === 'game_over') {
      return <GameOverDisplay
                gameState={gameState}
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }

    if (gameState.gamePhase === 'lobby') { 
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
      return <JudgeView gameState={gameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    
    if (thisPlayer && !thisPlayer.isJudge) {
      return <PlayerView gameState={gameState} player={thisPlayer} />;
    }
    
    return (
      <Card className="text-center">
        <CardHeader><CardTitle>Waiting for Game State</CardTitle></CardHeader>
        <CardContent><p>The game is in phase: {gameState.gamePhase}. Your role is being determined or an issue occurred.</p></CardContent>
      </Card>
    );
  };

  return (
    <>
      {showRecap && (
        <RecapSequenceDisplay
          lastWinnerPlayer={gameState.lastWinner!.player}
          lastWinnerCardText={gameState.lastWinner!.cardText}
          players={gameState.players}
          currentJudgeId={gameState.currentJudgeId}
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
        gameState={gameState}
        thisPlayer={thisPlayer}
        onScoresClick={() => setIsScoreboardOpen(true)}
        onMenuClick={() => setIsMenuModalOpen(true)}
      />
      
      {/* Modals */}
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
              players={gameState.players}
              currentJudgeId={gameState.currentJudgeId}
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