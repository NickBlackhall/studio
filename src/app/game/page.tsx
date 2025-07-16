
"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getGame,
  startGame,
  selectCategory,
  selectWinner,
  nextRound,
  resetGameForTesting,
  getCurrentPlayer
} from '@/app/game/actions';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
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
import TransitionOverlay from '@/components/ui/TransitionOverlay';

export default function GamePage() {
  const [internalGameState, setInternalGameState] = useState<GameClientState | null>(null);
  const gameStateRef = useRef<GameClientState | null>(null);

  const [thisPlayer, setThisPlayerInternal] = useState<PlayerClientState | null>(null);
  const thisPlayerRef = useRef<PlayerClientState | null>(null);

  const [isActionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { playTrack, stop: stopMusic, state: audioState, toggleMute, playSfx } = useAudio();

  const setGameState = useCallback((newState: GameClientState | null) => {
    console.log("DEBUG (GamePage): setGameState called.", { newState });
    gameStateRef.current = newState;
    if (isMountedRef.current) setInternalGameState(newState);
  }, []);

  const setThisPlayer = useCallback((newPlayerState: PlayerClientState | null) => {
    console.log("DEBUG (GamePage): setThisPlayer called.", { newPlayerState });
    thisPlayerRef.current = newPlayerState;
    if (isMountedRef.current) setThisPlayerInternal(newPlayerState);
  }, []);

  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    try {
      console.log(`DEBUG (GamePage): fetchGameAndPlayer called from: ${origin}`);
      console.time('fetchGameAndPlayer');
      const initialGameState = await getGame();
      console.timeLog('fetchGameAndPlayer', 'getGame complete');
      console.log("DEBUG (GamePage): fetchGameAndPlayer received game state:", initialGameState);

      if (!isMountedRef.current) {
        console.log("DEBUG (GamePage): fetchGameAndPlayer aborted, component unmounted.");
        return;
      }
      
      if (!initialGameState || !initialGameState.gameId) {
        toast({ title: "Game Not Found", description: "Could not find an active game session.", variant: "destructive" });
        router.push('/?step=setup');
        return;
      }
      
      const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${initialGameState.gameId}`);
      let playerDetails = null;

      if (playerIdFromStorage) {
        console.log(`DEBUG (GamePage): Found player ID in storage: ${playerIdFromStorage}`);
        if (initialGameState.players.some(p => p.id === playerIdFromStorage)) {
            console.log("DEBUG (GamePage): Player ID in game list. Fetching full player details.");
            playerDetails = await getCurrentPlayer(playerIdFromStorage, initialGameState.gameId);
            console.timeLog('fetchGameAndPlayer', 'getCurrentPlayer complete');
        } else {
             console.warn("DEBUG (GamePage): Player ID from storage not in current game. Removing and redirecting.");
             localStorage.removeItem(`thisPlayerId_game_${initialGameState.gameId}`);
             router.push('/?step=setup');
        }
      }

      setThisPlayer(playerDetails);
      setGameState(initialGameState);
      
    } catch (error: any) {
      console.error(`DEBUG (GamePage): CRITICAL ERROR in fetchGameAndPlayer (from ${origin}):`, error);
      toast({ title: "Error Loading Game", description: "Could not fetch game data.", variant: "destructive" });
    } finally {
      console.timeEnd('fetchGameAndPlayer');
    }
  }, [router, toast, setGameState, setThisPlayer]);
  
  useEffect(() => {
    isMountedRef.current = true;
    console.log("DEBUG (GamePage): Component did mount. Fetching initial game and player.");
    fetchGameAndPlayer("initial mount");

    return () => {
        console.log("DEBUG (GamePage): Component will unmount.");
        isMountedRef.current = false;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (internalGameState) {
      console.log(`DEBUG (GamePage): Game phase changed to ${internalGameState.gamePhase}. Updating music.`);
      if (internalGameState.gamePhase === 'game_over') {
        playTrack('lobby-music');
      } else if (ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase) || internalGameState.gamePhase === 'winner_announcement') {
        playTrack('game-music');
      } else {
        playTrack('lobby-music'); // Fallback for lobby state
      }
    }
    
    return () => {
        stopMusic();
    }
  }, [internalGameState?.gamePhase, playTrack, stopMusic]);

  useEffect(() => {
    if (!internalGameState || !internalGameState.gameId ) {
      console.log("DEBUG (GamePage): Real-time subscription effect skipped, no gameId.");
      return;
    }
    const gameId = internalGameState.gameId;
    console.log(`DEBUG (GamePage): Setting up real-time subscriptions for gameId: ${gameId}`);

    const debouncedFetch = async () => {
      if (!isMountedRef.current) return;
      console.log("DEBUG (GamePage): Debounced fetch triggered by real-time update.");

      const updatedFullGame = await getGame(gameId);
      if (!isMountedRef.current) return;

      if (updatedFullGame) {
        const currentLocalPlayerId = thisPlayerRef.current?.id;
        
        if (gameStateRef.current?.gamePhase === 'game_over' && updatedFullGame.gamePhase === 'lobby') {
          console.log("DEBUG (GamePage): Game has been reset, returning to lobby.");
          toast({ title: "Game Reset", description: "Returning to lobby setup." });
          router.push('/?step=setup');
          return;
        }

        setGameState(updatedFullGame);

        if (currentLocalPlayerId) {
          const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId);
           if (isMountedRef.current) setThisPlayer(latestPlayerDetails || null);
        }
      } else {
        const currentPhase = gameStateRef.current?.gamePhase;
        if (currentPhase !== 'game_over') {
            console.error("DEBUG (GamePage): getGame returned null during real-time update. Lost connection, redirecting.");
            if (isMountedRef.current) toast({ title: "Game Update Error", description: "Lost connection to game, redirecting to lobby.", variant: "destructive" });
            router.push('/?step=setup');
        }
      }
    };

    const commonPayloadHandler = (originTable: string, payload: any) => {
        console.log(`DEBUG (GamePage): Real-time update from '${originTable}'. Payload:`, payload);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(debouncedFetch, 300);
    };

    const channelsConfig = [
      { name: 'game-updates', table: 'games', filter: `id=eq.${gameId}`, event: 'UPDATE' },
      { name: 'players-updates', table: 'players', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'player-hands-updates', table: 'player_hands', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'submissions-updates', table: 'responses', filter: `game_id=eq.${gameId}`, event: '*' }
    ];

    const uniqueChannelSuffix = thisPlayerRef.current?.id || Date.now();

    const activeSubscriptions = channelsConfig.map(channelConfig => {
      const channelName = `${channelConfig.name}-${gameId}-${uniqueChannelSuffix}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
            event: channelConfig.event as any,
            schema: 'public',
            table: channelConfig.table,
            filter: channelConfig.filter
          },
          (payload) => commonPayloadHandler(channelConfig.table, payload)
        )
        .subscribe((status, err) => {
          console.log(`DEBUG (GamePage): Subscription status for ${channelName}: ${status}`);
          if (err) console.error(`Subscription error for ${channelName}:`, err);
        });
      return channel;
    });

    return () => {
      console.log("DEBUG (GamePage): Removing real-time subscriptions.");
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub).catch(err => console.error("Error removing channel:", err)));
    };
  }, [internalGameState?.gameId, setGameState, setThisPlayer, router, toast]);

  const handleNextRound = useCallback(async () => {
    const gameId = gameStateRef.current?.gameId;
    if (gameId) {
      try {
        await nextRound(gameId);
      } catch (error: any) {
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          throw error;
        } else {
          if (isMountedRef.current) toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
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
          if (isMountedRef.current) toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
        }
      });
    }
  };

  const handleSelectWinner = async (winningCardText: string) => {
    if (internalGameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectWinner(winningCardText, internalGameState.gameId);
        } catch (error: any) {
          if (isMountedRef.current) toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
        }
      });
    }
  };

  const handlePlayAgainYes = async () => {
    if (internalGameState?.gameId) {
      startActionTransition(async () => {
        try {
          await resetGameForTesting();
        } catch (error: any) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
              // Let Next.js handle the redirect
          } else {
            if (isMountedRef.current) {
              toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
            }
          }
        }
      });
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
            // Let Next.js handle the redirect
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

  // --- RENDER LOGIC ---
  console.log("DEBUG (GamePage): Top-level render check", { gameState: internalGameState, thisPlayer });

  if (!internalGameState) {
    console.log("DEBUG (GamePage): Rendering initial loading state.");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground">Loading Game Session...</p>
      </div>
    );
  }
  
  if (internalGameState.transitionState !== 'idle') {
    console.log(`DEBUG (GamePage): Rendering TransitionOverlay. State: ${internalGameState.transitionState}, Message: ${internalGameState.transitionMessage}`);
    return (
      <TransitionOverlay 
        transitionState={internalGameState.transitionState}
        message={internalGameState.transitionMessage}
      />
    );
  }

  if (!internalGameState.gameId) {
    console.error("DEBUG (GamePage): Rendering critical error, no gameId.");
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

  if (!thisPlayer && (ACTIVE_PLAYING_PHASES.includes(internalGameState.gamePhase) || internalGameState.gamePhase === 'game_over' || internalGameState.gamePhase === 'winner_announcement')) {
      console.log("DEBUG (GamePage): Rendering spectator view.");
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
     console.log("DEBUG (GamePage): Rendering 'Returned to Lobby' view.");
     return (
       <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
         <Image src="/ui/new-logo.png" alt="Game Logo - Lobby" width={100} height={100} className="mb-6" data-ai-hint="game logo"/>
         <h1 className="text-4xl font-bold text-primary mb-4">Game Has Returned to Lobby</h1>
         <p className="text-lg text-muted-foreground mb-8">
           The game session has been reset or ended. Please return to setup.
         </p>
          <Link href="/?step=setup" className="mt-6">
             <Button variant="default" size="lg">
                 Go to Player Setup & Lobby
             </Button>
         </Link>
       </div>
     );
  }

  if (!thisPlayer && internalGameState.gamePhase !== 'game_over' && internalGameState.gamePhase !== 'winner_announcement') {
     console.log("DEBUG (GamePage): Rendering 'Identifying player' screen.");
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl text-muted-foreground">Identifying player...</p>
          <p className="text-sm mt-2">If this persists, please return to the lobby.</p>
           <Link href="/?step=setup" className="mt-4">
            <Button variant="outline">Go to Lobby</Button>
          </Link>
        </div>
     );
  }

  const showRecap = internalGameState.gamePhase === 'winner_announcement' && internalGameState.lastWinner;
  console.log("DEBUG (GamePage): Final checks before main render.", { showRecap });

  const renderGameContent = () => {
    console.log(`DEBUG (GamePage): renderGameContent called. Game phase: ${internalGameState.gamePhase}, Is Judge: ${thisPlayer?.isJudge}`);
    if (internalGameState.gamePhase === 'game_over') {
      console.log("DEBUG (GamePage): Rendering GameOverDisplay.");
      return <GameOverDisplay
                gameState={internalGameState}
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }
    
    if (showRecap) {
      console.log("DEBUG (GamePage): Skipping main render for RecapSequenceDisplay.");
      return null;
    }

    if (thisPlayer?.isJudge) {
      console.log("DEBUG (GamePage): Rendering JudgeView.");
      return <JudgeView gameState={internalGameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    if (thisPlayer && !thisPlayer.isJudge) {
      console.log("DEBUG (GamePage): Rendering PlayerView.");
      return <PlayerView gameState={internalGameState} player={thisPlayer} />;
    }
    
    console.warn("DEBUG (GamePage): Rendering fallback 'Waiting for Game State' card.");
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Waiting for Game State</CardTitle></CardHeader>
            <CardContent>
              <Loader2 className="h-8 w-8 animate-spin mx-auto my-4 text-primary" />
              <p>The game is in phase: {internalGameState.gamePhase}. Your role is being determined.</p>
            </CardContent>
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
