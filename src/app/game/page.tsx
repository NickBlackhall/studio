
"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getGame,
  startGame,
  selectCategory,
  submitResponse,
  selectWinner,
  nextRound,
  getCurrentPlayer,
  resetGameForTesting
} from '@/app/game/actions';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import GameOverDisplay from '@/components/game/GameOverDisplay';
import RecapSequenceDisplay from '@/components/game/RecapSequenceDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, RefreshCw, HelpCircle } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import GameUI from '@/components/game/GameUI';

export default function GamePage() {
  const [internalGameState, setInternalGameState] = useState<GameClientState | null>(null);
  const gameStateRef = useRef<GameClientState | null>(null);

  const [thisPlayer, setThisPlayerInternal] = useState<PlayerClientState | null>(null);
  const thisPlayerRef = useRef<PlayerClientState | null>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isActionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  const isMountedRef = useRef(true);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);


  const setGameState = useCallback((newState: GameClientState | null) => {
    gameStateRef.current = newState;
    if (isMountedRef.current) setInternalGameState(newState);
  }, []);

  const setThisPlayer = useCallback((newPlayerState: PlayerClientState | null) => {
    thisPlayerRef.current = newPlayerState;
    if (isMountedRef.current) setThisPlayerInternal(newPlayerState);
  }, []);


  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    console.log(`GamePage: fetchGameAndPlayer called from ${origin}.`);
    let localGameId: string | null = null;
    try {
      const initialGameState = await getGame();
      if (!isMountedRef.current) return;

      setGameState(initialGameState);
      console.log(`GamePage: Initial gameState fetched (from ${origin}):`, initialGameState ? `ID: ${initialGameState.gameId}, Phase: ${initialGameState.gamePhase}, Players: ${initialGameState.players.length}` : "null");

      if (initialGameState && initialGameState.gameId) {
        localGameId = initialGameState.gameId;
        const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${localGameId}`);
        console.log(`GamePage: For gameId ${localGameId}, player ID from storage: ${playerIdFromStorage}`);

        if (playerIdFromStorage) {
          const playerInGameList = initialGameState.players.find(p => p.id === playerIdFromStorage);
          if (playerInGameList) {
            console.log(`GamePage: Player ${playerIdFromStorage} found in initial game state players list.`);
            setThisPlayer({ ...playerInGameList, hand: playerInGameList.hand || [] });
          } else {
            console.warn(`GamePage: Player ${playerIdFromStorage} NOT in initial game state for game ${localGameId}. Fetching directly.`);
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, localGameId);
            if (!isMountedRef.current) return;
            setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
            if (!playerDetail) {
                console.warn(`GamePage: Player ${playerIdFromStorage} could not be fetched for game ${localGameId}. Clearing localStorage.`);
                localStorage.removeItem(`thisPlayerId_game_${localGameId}`);
                 router.push('/?step=setup');
                 return;
            }
            console.log(`GamePage: Fetched thisPlayer details directly (from ${origin}):`, playerDetail ? playerDetail.id : "null", `Hand: ${playerDetail?.hand?.length}`);
          }
        } else {
          console.warn(`GamePage: No player ID found in localStorage for game ${localGameId}. Redirecting to setup.`);
          setThisPlayer(null);
          router.push('/?step=setup');
          return;
        }
      } else if (initialGameState && initialGameState.gamePhase === 'lobby' && initialGameState.players.length === 0) {
        console.log("GamePage: Lobby is empty or no gameId after fetch, redirecting to setup.");
        router.push('/?step=setup');
        return;
      } else if (!initialGameState || !initialGameState.gameId) {
        console.error("GamePage: Critical error - no gameId found after fetch. Redirecting to setup.");
        if (isMountedRef.current) toast({ title: "Game Not Found", description: "Could not find an active game session.", variant: "destructive" });
        router.push('/?step=setup');
        return;
      }
    } catch (error) {
      console.error(`GamePage: Error in fetchGameAndPlayer (from ${origin}):`, error);
      if (isMountedRef.current) toast({ title: "Error Loading Game", description: "Could not fetch game data.", variant: "destructive" });
    } finally {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
      console.log(`GamePage: fetchGameAndPlayer (from ${origin}) sequence ended.`);
    }
  }, [router, toast, setGameState, setThisPlayer]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log("GamePage: Mounting. Starting initial data fetch.");
    fetchGameAndPlayer("initial mount");

    return () => {
        isMountedRef.current = false;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!internalGameState || !internalGameState.gameId ) {
      console.log(`GamePage Realtime: Skipping subscription setup (no game/gameId). Current gameState ID: ${internalGameState?.gameId}`);
      return;
    }
    const gameId = internalGameState.gameId;
    const currentPlayerId = thisPlayerRef.current?.id;

    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}, thisPlayerId: ${currentPlayerId || 'N/A'}`);

    const debouncedFetch = async () => {
      console.log(`>>> GamePage Realtime (debounced for game ${gameId}): Fetching latest state.`);
      if (!isMountedRef.current) return;

      const updatedFullGame = await getGame(gameId);
      if (!isMountedRef.current) return;

      if (updatedFullGame) {
        const currentLocalPlayerId = thisPlayerRef.current?.id;

        if (gameStateRef.current?.gamePhase === 'game_over' && updatedFullGame.gamePhase === 'lobby') {
          console.log(`GamePage Realtime: Currently on game_over screen (ref gameId: ${gameStateRef.current?.gameId}). Received update that game ${updatedFullGame.gameId} is now 'lobby'. Suppressing full gameState update to allow user interaction with GameOverDisplay.`);
          if (currentLocalPlayerId) {
            const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId) || await getCurrentPlayer(currentLocalPlayerId, updatedFullGame.gameId);
            if (isMountedRef.current) setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
            console.log(`GamePage Realtime (game_over stickiness): Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
          }
          return;
        }

        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from debounced fetch. GameID: ${updatedFullGame.gameId}, Phase: ${updatedFullGame.gamePhase}, Players: ${updatedFullGame.players.length}`);

        if (currentLocalPlayerId) {
          const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId) || await getCurrentPlayer(currentLocalPlayerId, updatedFullGame.gameId);
           if (isMountedRef.current) setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
          console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
        } else {
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameId}`);
          if (playerIdFromStorage) {
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, gameId);
             if (isMountedRef.current) setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
            console.log(`GamePage Realtime: Re-identified thisPlayer after game update. ID: ${playerDetail?.id}, Hand: ${playerDetail?.hand?.length}`);
          }
        }
      } else {
        console.error(`GamePage Realtime: Failed to fetch updated game state after debounced fetch for game ${gameId}.`);
        const currentPhase = gameStateRef.current?.gamePhase;
        if (currentPhase !== 'game_over') {
            if (isMountedRef.current) toast({ title: "Game Update Error", description: "Lost connection to game, redirecting to lobby.", variant: "destructive" });
            router.push('/?step=setup');
        }
      }
    };

    const commonPayloadHandler = (originTable: string, payload: any) => {
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
          if (status === 'SUBSCRIBED') {
            console.log(`GamePage Realtime: Subscribed to ${channelName}`);
          } else if (status === 'CLOSED') {
            console.info(`GamePage Realtime: Channel ${channelName} is now ${status}. This is often due to explicit unsubscription or component unmount.`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`GamePage Realtime: Channel status for ${channelName}: ${status}`, err ? { message: err.message, name: err.name } : 'No error object.');
          } else if (err) {
            console.error(`GamePage Realtime: Unexpected error on ${channelName} subscription (status: ${status}):`, { message: err.message, name: err.name });
          }
        });
      return channel;
    });

    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}, suffix: ${uniqueChannelSuffix}`);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  }, [internalGameState?.gameId, setGameState, setThisPlayer, router, toast]);


  const handleNextRound = useCallback(async () => {
    let currentActionError: any = null;
    const gameId = gameStateRef.current?.gameId;
    if (gameId) {
      try {
        console.log(`GamePage: Calling nextRound server action for game ${gameId}`);
        await nextRound(gameId);
      } catch (error: any) {
        currentActionError = error;
        console.error("GamePage: Error starting next round:", error);
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("GamePage (handleNextRound): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          throw error;
        } else {
          if (isMountedRef.current) toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      }
    }
  }, [toast]);

  const handleStartGame = async () => {
    if (internalGameState?.gameId && internalGameState.gamePhase === 'lobby' && internalGameState.players.length >= MIN_PLAYERS_TO_START ) {
      startActionTransition(async () => {
        showGlobalLoader({ message: "Starting game...", players: internalGameState.players });
        console.log("GamePage: Client calling startGame server action.");
        try {
          await startGame(internalGameState.gameId);
          if (isMountedRef.current) toast({ title: "Game Starting!", description: "The judge is being assigned and cards dealt." });
        } catch (error: any) {
          console.error("GamePage: Error starting game:", error);
          if (isMountedRef.current) toast({title: "Cannot Start", description: error.message || "Failed to start game.", variant: "destructive"});
        } finally {
          if (isMountedRef.current) hideGlobalLoader();
        }
      });
    } else {
      if (isMountedRef.current) toast({title: "Cannot Start", description: `Not enough players or game not in lobby (current: ${internalGameState?.gamePhase}). Found ${internalGameState?.players?.length} players, need ${MIN_PLAYERS_TO_START}.`, variant: "destructive"})
    }
  };

  const handleSelectCategory = async (category: string) => {
    if (internalGameState?.gameId) {
      startActionTransition(async () => {
        showGlobalLoader({ message: "Unleashing scenario...", players: internalGameState.players });
        try {
          await selectCategory(internalGameState.gameId, category);
        } catch (error: any) {
          console.error("GamePage: Error selecting category:", error);
          if (isMountedRef.current) toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
        } finally {
          if (isMountedRef.current) hideGlobalLoader();
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
          console.error("GamePage: Error selecting winner:", error);
          if (isMountedRef.current) toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
        }
      });
    }
  };

  const handlePlayAgainYes = async () => {
    let currentActionError: any = null;
    if (internalGameState?.gameId) {
      console.log("GamePage: Player clicked 'Yes, Play Again!'. Calling resetGameForTesting.");
      showGlobalLoader({ message: 'Resetting game for another round of terror...' });
      startActionTransition(async () => {
        try {
          await resetGameForTesting();
        } catch (error: any) {
          currentActionError = error;
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            console.log("GamePage (handlePlayAgainYes): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
            return;
          } else {
            console.error("GamePage: Error on 'Play Again Yes':", error);
            if (isMountedRef.current) {
              toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
            }
          }
        } finally {
           let wasRedirect = false;
            if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) {
                wasRedirect = true;
            }
            if (!wasRedirect && isMountedRef.current) {
              hideGlobalLoader();
            }
        }
      });
    }
  };

  const handlePlayAgainNo = () => {
    console.log("GamePage: Player clicked 'No, I'm Done'. Navigating to home.");
    router.push('/');
  };

  const handleResetGameFromGamePage = async () => {
    console.log("🔴 RESET (GamePage Client): Button clicked - calling resetGameForTesting server action.");
    let currentActionError: any = null;
    showGlobalLoader({ message: "Resetting the game..." });
    startActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        currentActionError = error;
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("🔴 RESET (GamePage Client): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
        } else {
          console.error("🔴 RESET (GamePage Client): Error calling resetGameForTesting server action:", error);
          if (isMountedRef.current) {
            toast({
              title: "Reset Failed",
              description: `Could not reset the game. ${error.message || String(error)}`,
              variant: "destructive",
            });
          }
        }
      } finally {
        let wasRedirect = false;
        if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) {
            wasRedirect = true;
        }
        if (!wasRedirect && isMountedRef.current) {
           hideGlobalLoader();
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

  // New logic for handling spectators or players joining a game in progress
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
     const currentPhaseFromRef = gameStateRef.current?.gamePhase;
     if (currentPhaseFromRef && currentPhaseFromRef !== 'game_over' && currentPhaseFromRef !== 'winner_announcement') {
        console.log("GamePage: Game phase is 'lobby', current UI phase was not game_over/winner. Displaying lobby message.");
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
  }

  if (!thisPlayer && (internalGameState.gamePhase !== 'winner_announcement' && internalGameState.gamePhase !== 'game_over')) {
     console.warn("GamePage: thisPlayer object is null, but game is active and not in winner/game_over phase. Game state:", JSON.stringify(internalGameState, null, 2));
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
             console.error("GamePage: renderGameContent - thisPlayer is null during active game phase:", internalGameState.gamePhase);
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

  const showPendingOverlay = isActionPending;

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
          {showPendingOverlay && (
              <div className="absolute inset-0 bg-transparent flex items-center justify-center z-50 rounded-lg">
              </div>
          )}
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

      {/* Menu Modal */}
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

      {/* How to Play Modal */}
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
