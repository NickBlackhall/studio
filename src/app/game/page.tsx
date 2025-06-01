
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
import { MIN_PLAYERS_TO_START } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";


export default function GamePage() {
  const [internalGameState, setInternalGameState] = useState<GameClientState | null>(null);
  const gameStateRef = useRef<GameClientState | null>(null); // Ref to hold current gameState for subscription handler

  const [thisPlayer, setThisPlayerInternal] = useState<PlayerClientState | null>(null);
  const thisPlayerRef = useRef<PlayerClientState | null>(null); // Ref for thisPlayer

  const [isLoading, setIsLoading] = useState(true); // For initial load and major transitions
  const [isActionPending, startActionTransition] = useTransition(); // For general server action pending states
  const router = useRouter();
  const { toast } = useToast();
  const nextRoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Wrapper for setGameState to update ref as well
  const setGameState = useCallback((newState: GameClientState | null) => {
    gameStateRef.current = newState;
    setInternalGameState(newState);
  }, []);

  // Wrapper for setThisPlayer
  const setThisPlayer = useCallback((newPlayerState: PlayerClientState | null) => {
    thisPlayerRef.current = newPlayerState;
    setThisPlayerInternal(newPlayerState);
  }, []);

  const gameState = internalGameState; // Use this for rendering


  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    console.log(`GamePage: fetchGameAndPlayer called from ${origin}.`);
    if (!isLoading) { 
        setIsLoading(true);
    }
    let localGameId: string | null = null;
    try {
      const initialGameState = await getGame(); 
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
        toast({ title: "Game Not Found", description: "Could not find an active game session.", variant: "destructive" });
        router.push('/?step=setup');
        return;
      }
    } catch (error) {
      console.error(`GamePage: Error in fetchGameAndPlayer (from ${origin}):`, error);
      toast({ title: "Error Loading Game", description: "Could not fetch game data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      console.log(`GamePage: fetchGameAndPlayer (from ${origin}) sequence ended. isLoading: ${false}`);
    }
  }, [router, toast, isLoading, setGameState, setThisPlayer]); 

  useEffect(() => {
    console.log("GamePage: Mounting. Starting initial data fetch.");
    fetchGameAndPlayer("initial mount");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchGameAndPlayer is stable due to its own deps

  useEffect(() => {
    if (!gameState || !gameState.gameId ) { 
      console.log(`GamePage Realtime: Skipping subscription setup (no game/gameId). Current gameState ID: ${gameState?.gameId}`);
      return;
    }
    const gameId = gameState.gameId;
    const currentPlayerId = thisPlayerRef.current?.id; // Use ref for current player ID

    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}, thisPlayerId: ${currentPlayerId || 'N/A'}`);

    const commonPayloadHandler = async (originTable: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${originTable} sub for game ${gameId}): CHANGE DETECTED!`, payload);
      
      const updatedFullGame = await getGame(gameId); 
      if (updatedFullGame) {
        const currentLocalPlayerId = thisPlayerRef.current?.id; // Get current player ID from ref
        
        if (gameStateRef.current?.gamePhase === 'game_over' && updatedFullGame.gamePhase === 'lobby') {
          console.log(`GamePage Realtime: Currently on game_over screen (ref gameId: ${gameStateRef.current?.gameId}). Received update that game ${updatedFullGame.gameId} is now 'lobby'. Suppressing full gameState update to allow user interaction with WinnerDisplay.`);
          if (currentLocalPlayerId) {
            const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId) || await getCurrentPlayer(currentLocalPlayerId, updatedFullGame.gameId);
            setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
            console.log(`GamePage Realtime (game_over stickiness): Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
          }
          return; 
        }
        
        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from ${originTable} event. GameID: ${updatedFullGame.gameId}, Phase: ${updatedFullGame.gamePhase}, Players: ${updatedFullGame.players.length}`);
        
        if (currentLocalPlayerId) {
          const latestPlayerDetails = updatedFullGame.players.find(p => p.id === currentLocalPlayerId) || await getCurrentPlayer(currentLocalPlayerId, updatedFullGame.gameId);
          setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
          console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
        } else {
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameId}`);
          if (playerIdFromStorage) {
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, gameId);
            setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
            console.log(`GamePage Realtime: Re-identified thisPlayer after game update. ID: ${playerDetail?.id}, Hand: ${playerDetail?.hand?.length}`);
          }
        }
      } else {
        console.error(`GamePage Realtime: Failed to fetch updated game state after ${originTable} event for game ${gameId}.`);
        const currentPhase = gameStateRef.current?.gamePhase;
        if (currentPhase !== 'game_over') { 
            toast({ title: "Game Update Error", description: "Lost connection to game, redirecting to lobby.", variant: "destructive" });
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
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, [gameState?.gameId, setGameState, setThisPlayer, router, toast]); 

  useEffect(() => {
    const currentJudge = thisPlayerRef.current?.isJudge;
    const currentPhase = gameStateRef.current?.gamePhase;
    const currentGameId = gameStateRef.current?.gameId;

    if (currentPhase === 'winner_announcement' && currentJudge) { 
      console.log(`GamePage: Player ${thisPlayerRef.current?.name} is judge. Setting 5s timer for next round.`);
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
      nextRoundTimeoutRef.current = setTimeout(() => {
        if (currentGameId && thisPlayerRef.current?.isJudge && gameStateRef.current?.gamePhase === 'winner_announcement') { 
             console.log(`GamePage: Timer expired for judge ${thisPlayerRef.current?.name}. Calling handleNextRound.`);
             handleNextRound(); 
        }
      }, 5000); 
    }

    return () => {
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.gamePhase, thisPlayer?.isJudge]); 


  const handleStartGame = async () => {
    if (gameState?.gameId && gameState.gamePhase === 'lobby' && gameState.players.length >= MIN_PLAYERS_TO_START ) { 
      startActionTransition(async () => {
        console.log("GamePage: Client calling startGame server action.");
        try {
          await startGame(gameState.gameId); 
          toast({ title: "Game Starting!", description: "The judge is being assigned and cards dealt." });
        } catch (error: any) {
          console.error("GamePage: Error starting game:", error);
          toast({title: "Cannot Start", description: error.message || "Failed to start game.", variant: "destructive"});
        }
      });
    } else {
      toast({title: "Cannot Start", description: `Not enough players or game not in lobby (current: ${gameState?.gamePhase}). Found ${gameState?.players?.length} players, need ${MIN_PLAYERS_TO_START}.`, variant: "destructive"})
    }
  };
  
  const handleSelectCategory = async (category: string) => {
    if (gameState?.gameId) {
      startActionTransition(async () => {
        try {
          await selectCategory(gameState.gameId, category);
        } catch (error: any) {
          console.error("GamePage: Error selecting category:", error);
          toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
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
          toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
        }
      });
    }
  };

  const handleNextRound = async () => {
    let currentActionError: any = null; 
    if (gameState?.gameId) {
      setIsLoading(true); 
      try {
        console.log(`GamePage: Calling nextRound server action for game ${gameState.gameId}`);
        await nextRound(gameState.gameId);
      } catch (error: any) {
        currentActionError = error; 
        console.error("GamePage: Error starting next round:", error);
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("GamePage (handleNextRound): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          return; 
        } else {
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      } finally {
        let wasRedirect = false;
        if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) { 
            wasRedirect = true;
        }
        if (!wasRedirect) {
           setIsLoading(false);
        }
      }
    }
  };

  const handlePlayAgainYes = async () => {
    let currentActionError: any = null;
    if (gameState?.gameId) {
      console.log("GamePage: Player clicked 'Yes, Play Again!'. Calling resetGameForTesting.");
      setIsLoading(true);
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
            toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
          }
        } finally {
           let wasRedirect = false;
            if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) { 
                wasRedirect = true;
            }
            if (!wasRedirect) {
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
    setIsLoading(true);
    let currentActionError: any = null;
    startActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        currentActionError = error;
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("🔴 RESET (GamePage Client): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
        } else {
          console.error("🔴 RESET (GamePage Client): Error calling resetGameForTesting server action:", error);
          toast({
            title: "Reset Failed",
            description: `Could not reset the game. ${error.message || String(error)}`,
            variant: "destructive",
          });
        }
      } finally {
        let wasRedirect = false;
        if (currentActionError && typeof currentActionError.digest === 'string' && currentActionError.digest.startsWith('NEXT_REDIRECT')) { 
            wasRedirect = true;
        }
        if (!wasRedirect) {
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
        <Link href="/?step=setup">
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
             <Link href="/?step=setup" className="mt-6">
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
           <Link href="/?step=setup" className="mt-4">
            <Button variant="outline">Go to Lobby</Button>
          </Link>
        </div>
     );
  }

  const renderGameContent = () => {
    if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
        if (['category_selection', 'player_submission', 'judging'].includes(gameState.gamePhase)) {
             console.error("GamePage: renderGameContent - thisPlayer is null during active game phase:", gameState.gamePhase);
            return (
                <Card className="text-center">
                    <CardHeader><CardTitle className="text-destructive">Player Identification Error</CardTitle></CardHeader>
                    <CardContent><p>Could not identify your player profile for this active game. Please try returning to the lobby.</p></CardContent>
                </Card>
            );
        }
    }

    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay 
                gameState={gameState} 
                onNextRound={handleNextRound} 
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

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 py-4 md:py-8 max-w-7xl mx-auto px-2">
      <aside className="w-full md:w-1/3 lg:w-1/4">
        <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Round {gameState.currentRound}</p>
          <Link href="/?step=setup" className="inline-block">
            <Button variant="outline" size="sm" className="border-primary/50 text-primary/80 hover:bg-primary/10 hover:text-primary">
              <Home className="mr-1 h-4 w-4" /> Exit to Lobby
            </Button>
          </Link>
          <Button 
            onClick={handleResetGameFromGamePage} 
            variant="destructive" 
            size="sm" 
            className="w-full" 
            disabled={isActionPending || isLoading}
          >
            { (isActionPending || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" /> } 
            Reset Game (Testing)
          </Button>
        </div>
      </aside>
      <main className="flex-grow w-full md:w-2/3 lg:w-3/4 relative">
        {showPendingOverlay && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-50 rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )}
        {thisPlayer && (
          <Card className="mb-4 bg-muted/80 border-primary/30 shadow">
            <CardContent className="p-3 flex items-center justify-center text-center">
              {thisPlayer.avatar && thisPlayer.avatar.startsWith('/') ? (
                <Image 
                  src={thisPlayer.avatar} 
                  alt={`${thisPlayer.name}'s avatar`} 
                  width={28} 
                  height={28}
                  className="mr-2 rounded-md object-cover"
                />
              ) : (
                <span className="text-2xl mx-1">{thisPlayer.avatar}</span>
              )}
              <p className="text-sm text-foreground font-medium">
                You are: <strong>{thisPlayer.name}</strong>
              </p>
            </CardContent>
          </Card>
        )}
        {renderGameContent()}
      </main>
    </div>
  );
}
export const dynamic = 'force-dynamic';

