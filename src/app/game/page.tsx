
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
import WinnerDisplay from '@/components/game/WinnerDisplay';
import RecapSequenceDisplay from '@/components/game/RecapSequenceDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, RefreshCw, HelpCircle } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogPortal,
  DialogOverlay
} from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';


export default function GamePage() {
  const [internalGameState, setInternalGameState] = useState<GameClientState | null>(null);
  const gameStateRef = useRef<GameClientState | null>(null);

  const [thisPlayer, setThisPlayerInternal] = useState<PlayerClientState | null>(null);
  const thisPlayerRef = useRef<PlayerClientState | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, startActionTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  const isMountedRef = useRef(true);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);

  const [recapStepInternal, setRecapStepInternal] = useState<'winner' | 'scoreboard' | 'getReady' | null>(null);
  const recapStepTimerRef = useRef<NodeJS.Timeout | null>(null);


  const setGameState = useCallback((newState: GameClientState | null) => {
    gameStateRef.current = newState;
    if (isMountedRef.current) setInternalGameState(newState);
  }, []);

  const setThisPlayer = useCallback((newPlayerState: PlayerClientState | null) => {
    thisPlayerRef.current = newPlayerState;
    if (isMountedRef.current) setThisPlayerInternal(newPlayerState);
  }, []);

  const gameState = internalGameState;


  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    console.log(`GamePage: fetchGameAndPlayer called from ${origin}.`);
    if (!isLoading && isMountedRef.current) {
        // setIsLoading(true);
    }
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
        setIsLoading(false);
        hideGlobalLoader();
      }
      console.log(`GamePage: fetchGameAndPlayer (from ${origin}) sequence ended. isLoading: ${false}`);
    }
  }, [router, toast, isLoading, setGameState, setThisPlayer, hideGlobalLoader]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log("GamePage: Mounting. Starting initial data fetch.");
    fetchGameAndPlayer("initial mount");

    return () => {
        isMountedRef.current = false;
        if (recapStepTimerRef.current) {
            clearTimeout(recapStepTimerRef.current);
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gameState || !gameState.gameId ) {
      console.log(`GamePage Realtime: Skipping subscription setup (no game/gameId). Current gameState ID: ${gameState?.gameId}`);
      return;
    }
    const gameId = gameState.gameId;
    const currentPlayerId = thisPlayerRef.current?.id;

    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}, thisPlayerId: ${currentPlayerId || 'N/A'}`);

    const commonPayloadHandler = async (originTable: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${originTable} sub for game ${gameId}): CHANGE DETECTED!`, payload);
      if (!isMountedRef.current) return;

      const updatedFullGame = await getGame(gameId);
      if (!isMountedRef.current) return;

      if (updatedFullGame) {
        const currentLocalPlayerId = thisPlayerRef.current?.id;

        if (gameStateRef.current?.gamePhase === 'game_over' && updatedFullGame.gamePhase === 'lobby') {
          console.log(`GamePage Realtime: Currently on game_over screen (ref gameId: ${gameStateRef.current?.gameId}). Received update that game ${updatedFullGame.gameId} is now 'lobby'. Suppressing full gameState update to allow user interaction with WinnerDisplay.`);
          if (currentLocalPlayerId) {
            const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId) || await getCurrentPlayer(currentLocalPlayerId, updatedFullGame.gameId);
            if (isMountedRef.current) setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
            console.log(`GamePage Realtime (game_over stickiness): Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
          }
          return;
        }

        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from ${originTable} event. GameID: ${updatedFullGame.gameId}, Phase: ${updatedFullGame.gamePhase}, Players: ${updatedFullGame.players.length}`);

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
        console.error(`GamePage Realtime: Failed to fetch updated game state after ${originTable} event for game ${gameId}.`);
        const currentPhase = gameStateRef.current?.gamePhase;
        if (currentPhase !== 'game_over') {
            if (isMountedRef.current) toast({ title: "Game Update Error", description: "Lost connection to game, redirecting to lobby.", variant: "destructive" });
            router.push('/?step=setup');
        }
      }
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
            if (err) {
              console.error(`GamePage Realtime: Error details for ${channelName} (status: ${status}):`, {
                message: err.message,
                name: err.name,
                errorObject: { ...err }
              });
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`GamePage Realtime: Channel status for ${channelName}: ${status}`);
            if (err) {
              console.error(`GamePage Realtime: Error details for ${channelName} (status: ${status}):`, {
                message: err.message,
                name: err.name,
                errorObject: { ...err }
              });
            } else {
              console.warn(`GamePage Realtime: ${status} for ${channelName} with no additional error object.`);
            }
          } else if (err) {
            console.error(`GamePage Realtime: Unexpected error on ${channelName} subscription (status: ${status}):`, {
                message: err.message,
                name: err.name,
                errorObject: { ...err }
            });
          }
        });
      return channel;
    });

    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}, suffix: ${uniqueChannelSuffix}`);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  }, [gameState?.gameId, setGameState, setThisPlayer, router, toast]);


  useEffect(() => {
    if (recapStepTimerRef.current) {
      clearTimeout(recapStepTimerRef.current);
    }

    const currentGamePhase = gameStateRef.current?.gamePhase;

    if (currentGamePhase === 'winner_announcement') {
      if (recapStepInternal === null) {
        console.log("GamePage: recapEffect - Starting sequence, setting to 'winner'");
        if (isMountedRef.current) setRecapStepInternal('winner');
        return; 
      }
    } else {
      if (recapStepInternal !== null) {
        console.log("GamePage: recapEffect - Game phase NOT winner_announcement. Clearing recapStep.");
        if (isMountedRef.current) setRecapStepInternal(null);
      }
      return; 
    }

    if (recapStepInternal === 'winner') {
      console.log("GamePage: recapEffect - Current step 'winner'. Setting timer for 'scoreboard'.");
      recapStepTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && gameStateRef.current?.gamePhase === 'winner_announcement') {
          console.log("GamePage: recapEffect - Timer expired for 'winner'. Transitioning to 'scoreboard'.");
          setRecapStepInternal('scoreboard');
        }
      }, 5000);
    } else if (recapStepInternal === 'scoreboard') {
      console.log("GamePage: recapEffect - Current step 'scoreboard'. Setting timer for 'getReady'.");
      recapStepTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && gameStateRef.current?.gamePhase === 'winner_announcement') {
          console.log("GamePage: recapEffect - Timer expired for 'scoreboard'. Transitioning to 'getReady'.");
          setRecapStepInternal('getReady');
        }
      }, 5000);
    } else if (recapStepInternal === 'getReady') {
      console.log("GamePage: recapEffect - Current step 'getReady'. Setting timer for next round action / clear.");
      recapStepTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && gameStateRef.current?.gamePhase === 'winner_announcement') {
          const currentThisPlayer = thisPlayerRef.current;
          if (currentThisPlayer?.isJudge && gameStateRef.current?.gameId) {
            console.log(`GamePage: recapEffect - Timer expired for 'getReady'. Judge ${currentThisPlayer.name} calling handleNextRound.`);
            handleNextRound(); // Call the action
            setRecapStepInternal(null); // Immediately clear recap for judge
          } else {
            console.log("GamePage: recapEffect - Timer expired for 'getReady'. Non-judge or no gameId. Clearing recapStep.");
            setRecapStepInternal(null);
          }
        }
      }, 5000);
    }

    return () => {
      if (recapStepTimerRef.current) {
        clearTimeout(recapStepTimerRef.current);
      }
    };
  }, [internalGameState?.gamePhase, recapStepInternal, thisPlayer?.isJudge]);


  const handleStartGame = async () => {
    if (gameState?.gameId && gameState.gamePhase === 'lobby' && gameState.players.length >= MIN_PLAYERS_TO_START ) {
      startActionTransition(async () => {
        console.log("GamePage: Client calling startGame server action.");
        try {
          await startGame(gameState.gameId);
          if (isMountedRef.current) toast({ title: "Game Starting!", description: "The judge is being assigned and cards dealt." });
        } catch (error: any) {
          console.error("GamePage: Error starting game:", error);
          if (isMountedRef.current) toast({title: "Cannot Start", description: error.message || "Failed to start game.", variant: "destructive"});
        }
      });
    } else {
      if (isMountedRef.current) toast({title: "Cannot Start", description: `Not enough players or game not in lobby (current: ${gameState?.gamePhase}). Found ${gameState?.players?.length} players, need ${MIN_PLAYERS_TO_START}.`, variant: "destructive"})
    }
  };

  const handleSelectCategory = async (category: string) => {
    if (gameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectCategory(gameState.gameId, category);
        } catch (error: any) {
          console.error("GamePage: Error selecting category:", error);
          if (isMountedRef.current) toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
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
          console.error("GamePage: Error selecting winner:", error);
          if (isMountedRef.current) toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
        }
      });
    }
  };

  const handleNextRound = async () => {
    let currentActionError: any = null;
    if (gameStateRef.current?.gameId) { // Use ref here for potentially immediate calls
      if (isMountedRef.current) setIsLoading(true); // Still might be useful for immediate visual feedback
      try {
        console.log(`GamePage: Calling nextRound server action for game ${gameStateRef.current.gameId}`);
        await nextRound(gameStateRef.current.gameId);
      } catch (error: any) {
        currentActionError = error;
        console.error("GamePage: Error starting next round:", error);
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("GamePage (handleNextRound): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          // Don't setIsLoading(false) here as the page will navigate away
          return; 
        } else {
          if (isMountedRef.current) toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      } finally {
        let wasRedirect = false;
        if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) {
            wasRedirect = true;
        }
        if (!wasRedirect && isMountedRef.current) {
           setIsLoading(false);
        }
      }
    }
  };

  const handlePlayAgainYes = async () => {
    let currentActionError: any = null;
    if (gameState?.gameId) {
      console.log("GamePage: Player clicked 'Yes, Play Again!'. Calling resetGameForTesting.");
      if (isMountedRef.current) {
        setIsLoading(true);
      }
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
              setIsLoading(false);
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
    if (isMountedRef.current) {
        setIsLoading(true);
    }
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
           setIsLoading(false);
        }
      }
    });
  };


  if (isLoading && (!gameState || (!thisPlayer && gameState?.gamePhase !== 'winner_announcement' && gameState?.gamePhase !== 'game_over' && gameState?.gamePhase !== 'lobby'))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-2xl text-muted-foreground">Loading Game Awesomeness...</p>
      </div>
    );
  }

  if (!gameState || !gameState.gameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="/logo.png" alt="Game Logo - Error" width={182} height={54} className="mb-6 opacity-70" data-ai-hint="game logo"/>
        <h1 className="text-4xl font-bold text-destructive mb-4">Critical Game Error!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Could not load or initialize the game session. Please try again or reset.
        </p>
        <Link href="/?step=setup" onClick={() => {  }}>
          <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Lobby Setup
          </Button>
        </Link>
      </div>
    );
  }

  if (gameState.gamePhase === 'lobby') {
     const currentPhaseFromRef = gameStateRef.current?.gamePhase;
     if (currentPhaseFromRef && currentPhaseFromRef !== 'game_over' && currentPhaseFromRef !== 'winner_announcement') {
        console.log("GamePage: Game phase is 'lobby', current UI phase was not game_over/winner. Displaying lobby message.");
        return (
          <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image src="/logo.png" alt="Game Logo - Lobby" width={182} height={54} className="mb-6" data-ai-hint="game logo"/>
            <h1 className="text-4xl font-bold text-primary mb-4">Game Has Returned to Lobby</h1>
            <p className="text-lg text-muted-foreground mb-8">
              The game session has been reset or ended.
            </p>
             <Link href="/?step=setup" className="mt-6" onClick={() => {  }}>
                <Button variant="default" size="lg">
                    Go to Player Setup & Lobby
                </Button>
            </Link>
          </div>
        );
     }
  }

  if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
     console.warn("GamePage: thisPlayer object is null, but game is active and not in winner/game_over phase. Game state:", JSON.stringify(gameState, null, 2));
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl text-muted-foreground">Identifying player...</p>
          <p className="text-sm mt-2">If this persists, you might not be part of this game or try returning to the lobby.</p>
           <Link href="/?step=setup" className="mt-4" onClick={() => {  }}>
            <Button variant="outline">Go to Lobby</Button>
          </Link>
        </div>
     );
  }

  const renderGameContent = () => {
    if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
        if (ACTIVE_PLAYING_PHASES.includes(gameState.gamePhase)) {
             console.error("GamePage: renderGameContent - thisPlayer is null during active game phase:", gameState.gamePhase);
            return (
                <Card className="text-center">
                    <CardHeader><CardTitle className="text-destructive">Player Identification Error</CardTitle></CardHeader>
                    <CardContent><p>Could not identify your player profile for this active game. Please try returning to the lobby.</p></CardContent>
                </Card>
            );
        }
    }

    if (gameState.gamePhase === 'game_over') {
      return <WinnerDisplay
                gameState={gameState}
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }

    if (gameState.gamePhase === 'lobby') { // Will only show if game became lobby while recap might have been considered
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-semibold mb-4">Game is in Lobby</h2>
                <p className="mb-4">The game has returned to the lobby. Please go to player setup.</p>
                <Link href="/?step=setup" onClick={() => {  }}>
                    <Button>Go to Lobby Setup</Button>
                </Link>
            </div>
        );
    }

    // If in recap sequence, main game content is usually obscured by RecapSequenceDisplay
    if (recapStepInternal) {
      return null; // Or a minimal background if RecapSequenceDisplay isn't full-screen
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

  const showPendingOverlay = isActionPending && !isLoading;
  const shouldShowPlayerInfoBar = thisPlayer &&
                                  !thisPlayer.isJudge &&
                                  gameState.gamePhase !== 'winner_announcement' &&
                                  gameState.gamePhase !== 'game_over' &&
                                  !recapStepInternal; // Also hide if recap is active

  return (
    <>
      {recapStepInternal && gameState && gameState.lastWinner && (
        <RecapSequenceDisplay
          recapStep={recapStepInternal}
          lastWinnerPlayer={gameState.lastWinner.player}
          lastWinnerCardText={gameState.lastWinner.cardText}
          players={gameState.players}
          currentJudgeId={gameState.currentJudgeId}
          // nextJudgeName - can be implemented later
        />
      )}
      <div className={`flex flex-col md:flex-row gap-4 md:gap-8 py-4 md:py-8 max-w-7xl mx-auto px-2 ${recapStepInternal ? 'opacity-20 pointer-events-none' : ''}`}>
        <main className="flex-grow w-full md:w-2/3 lg:w-3/4 relative order-1 md:order-2">
          {showPendingOverlay && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-50 rounded-lg">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
          )}
          {shouldShowPlayerInfoBar && (
            <Card className="mb-4 bg-accent text-accent-foreground shadow-lg">
              <CardContent className="p-2 flex items-center justify-start text-left">
                {thisPlayer.avatar && thisPlayer.avatar.startsWith('/') ? (
                  <Image
                    src={thisPlayer.avatar}
                    alt={`${thisPlayer.name}'s avatar`}
                    width={36}
                    height={36}
                    className="mr-3 rounded-md object-cover"
                    data-ai-hint="player avatar"
                  />
                ) : (
                  <span className="text-3xl mr-3">{thisPlayer.avatar}</span>
                )}
                <p className="text-lg text-accent-foreground font-semibold">
                  <strong>{thisPlayer.name}</strong> - {thisPlayer.score} pts
                </p>
              </CardContent>
            </Card>
          )}
          {renderGameContent()}
        </main>
        <aside className="w-full md:w-1/3 lg:w-1/4 order-2 md:order-1">
          <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Round {gameState.currentRound}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/?step=setup" className="inline-block" onClick={() => {  }}>
                <Button variant="outline" size="sm" className="border-primary/50 text-primary/80 hover:bg-primary/10 hover:text-primary w-full sm:w-auto">
                  <Home className="mr-1 h-4 w-4" /> Exit to Lobby
                </Button>
              </Link>
              <Dialog open={isHowToPlayModalOpen} onOpenChange={setIsHowToPlayModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-accent text-accent-foreground hover:bg-accent/80 w-full sm:w-auto">
                    <HelpCircle className="mr-2 h-4 w-4" /> How to Play
                  </Button>
                </DialogTrigger>
                {isHowToPlayModalOpen && (
                  <DialogPortal>
                    <DialogOverlay />
                    <DialogContent>
                      <HowToPlayModalContent />
                    </DialogContent>
                  </DialogPortal>
                )}
              </Dialog>
            </div>
            <Button
              onClick={handleResetGameFromGamePage}
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              disabled={isActionPending || isLoading}
            >
              { (isActionPending || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" /> }
              Reset Game (Testing)
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
export const dynamic = 'force-dynamic';


    