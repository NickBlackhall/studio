
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
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, UserCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";


export default function GamePage() {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, startActionTransition] = useTransition(); 
  const router = useRouter();
  const { toast } = useToast();
  const nextRoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    console.log(`GamePage: fetchGameAndPlayer called from ${origin}.`);
    setIsLoading(true); // Always set loading true at the start of a fetch
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
            console.warn(`GamePage: Player ${playerIdFromStorage} NOT in initial game state. Attempting direct fetch for game ${localGameId}. Player might have been removed or game reset.`);
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, localGameId);
            setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
            if (!playerDetail) {
                console.warn(`GamePage: Player ${playerIdFromStorage} could not be fetched directly for game ${localGameId}. Clearing from localStorage.`);
                localStorage.removeItem(`thisPlayerId_game_${localGameId}`);
                 router.push('/?step=setup'); // Player no longer valid for this game, send to lobby
                 return; // Exit early
            }
            console.log(`GamePage: Fetched thisPlayer details directly (from ${origin}):`, playerDetail ? playerDetail.id : "null");
          }
        } else {
          console.warn(`GamePage: No player ID found in localStorage for game ${localGameId}. thisPlayer will be null. Consider redirecting to setup.`);
          setThisPlayer(null);
          // Optional: redirect if no player ID and game is active
           if (initialGameState.gamePhase !== 'lobby' && initialGameState.gamePhase !== 'game_over') {
             router.push('/?step=setup');
             return;
           }
        }
      } else if (initialGameState && initialGameState.gamePhase === 'lobby' && initialGameState.players.length === 0) {
        console.log("GamePage: Lobby is empty or no gameId, redirecting to setup.");
        router.push('/?step=setup'); 
        return;
      } else if (!initialGameState || !initialGameState.gameId) {
        console.error("GamePage: Critical error - no gameId found after fetch. Redirecting to setup.");
        toast({ title: "Game Not Found", description: "Could not find an active game session. Please try setting up again.", variant: "destructive" });
        router.push('/?step=setup');
        return;
      }
    } catch (error) {
      console.error(`GamePage: Error in fetchGameAndPlayer (from ${origin}):`, error);
      toast({ title: "Error Loading Game", description: "Could not fetch game data. Please try refreshing or resetting.", variant: "destructive" });
      // router.push('/?step=setup'); // Consider if this is always the right action
    } finally {
      setIsLoading(false);
      console.log(`GamePage: fetchGameAndPlayer (from ${origin}) sequence ended. isLoading: ${false}`);
    }
  }, [router, toast]); 

  useEffect(() => {
    console.log("GamePage: Mounting. Starting initial data fetch.");
    fetchGameAndPlayer("initial mount");
  }, [fetchGameData]);

  useEffect(() => {
    if (!gameState || !gameState.gameId ) { 
      console.log(`GamePage Realtime: Skipping general subscription setup (no game/gameId). Current gameState: ${gameState?.gameId}`);
      return;
    }
    const gameId = gameState.gameId;
    const currentPlayerId = thisPlayer?.id; // Can be undefined if thisPlayer is not set yet

    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}, thisPlayerId: ${currentPlayerId || 'N/A'}`);

    const commonPayloadHandler = async (originTable: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${originTable} sub for game ${gameId}): CHANGE DETECTED!`, payload);
      
      const updatedFullGame = await getGame(gameId); // Fetch with the stable gameId
      if (updatedFullGame) {
        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from ${originTable} event. GameID: ${updatedFullGame.gameId}, Phase: ${updatedFullGame.gamePhase}, Players: ${updatedFullGame.players.length}`);
        
        // Refresh thisPlayer details only if currentPlayerId was defined when subscriptions were set up
        if (currentPlayerId) {
          const latestPlayerDetails = await getCurrentPlayer(currentPlayerId, updatedFullGame.gameId);
          setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
          console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
        } else {
          // If no currentPlayerId initially, try to re-identify after game state update
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameId}`);
          if (playerIdFromStorage) {
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, gameId);
            setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
          }
        }
      } else {
        console.error(`GamePage Realtime: Failed to fetch updated game state after ${originTable} event for game ${gameId}.`);
      }
    };

    const channels = [
      { name: 'game-updates', table: 'games', filter: `id=eq.${gameId}`, event: 'UPDATE' },
      { name: 'players-updates', table: 'players', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'player-hands-updates', table: 'player_hands', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'submissions-updates', table: 'responses', filter: `game_id=eq.${gameId}`, event: '*' }
    ];
    
    const channelSuffix = currentPlayerId || Date.now(); // Use timestamp as fallback for uniqueness if no player ID

    const activeSubscriptions = channels.map(channelConfig => {
      const channel = supabase
        .channel(`${channelConfig.name}-${gameId}-${channelSuffix}`) 
        .on('postgres_changes', { 
            event: channelConfig.event as any, 
            schema: 'public', 
            table: channelConfig.table, 
            filter: channelConfig.filter 
          },
          (payload) => commonPayloadHandler(channelConfig.table, payload)
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to ${channelConfig.name}-${gameId}-${channelSuffix}`);
          if (err) console.error(`GamePage Realtime: Error on ${channelConfig.name}-${gameId}-${channelSuffix} subscription:`, err);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`GamePage Realtime: Channel error for ${channelConfig.name}-${gameId}-${channelSuffix}: ${status}`, err ? JSON.stringify(err) : 'undefined');
          }
        });
      return channel;
    });

    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}, suffix: ${channelSuffix}`);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, [gameState?.gameId, thisPlayer?.id]); // Re-subscribe if gameId or thisPlayer.id changes

  useEffect(() => {
    if (gameState?.gamePhase === 'winner_announcement' && thisPlayer?.isJudge) { 
      console.log(`GamePage: Player ${thisPlayer.name} is judge. Setting 5s timer for next round.`);
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
      nextRoundTimeoutRef.current = setTimeout(() => {
        if (gameState?.gameId && thisPlayer?.isJudge && gameState.gamePhase === 'winner_announcement') { 
             console.log(`GamePage: Timer expired for judge ${thisPlayer.name}. Calling handleNextRound.`);
             handleNextRound();
        }
      }, 5000); 
    }

    return () => {
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, [gameState?.gamePhase, gameState?.gameId, thisPlayer?.isJudge, thisPlayer?.name]);


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
    if (gameState?.gameId) {
      setIsLoading(true); // Set loading before calling server action
      try {
        console.log(`GamePage: Calling nextRound server action for game ${gameState.gameId}`);
        await nextRound(gameState.gameId);
        // Navigation or state update will be handled by server action redirect or real-time updates
      } catch (error: any) {
        console.error("GamePage: Error starting next round:", error);
        if (error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("GamePage (handleNextRound): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          // Do not setIsLoading(false) here as page will navigate
          return; 
        } else {
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
           setIsLoading(false); // Only set loading false if it's not a redirect error
        }
      } 
      // If not a redirect error, and no other error occurred, it might still be loading from state propagation
      // Let's ensure isLoading is false if the try block completed without redirect or specific error
      // This will be handled by the finally block in fetchGameAndPlayer or real-time updates setting game state
    }
  };

  const handlePlayAgainYes = async () => {
    if (gameState?.gameId) {
      // Use startActionTransition for visual feedback if desired, or just setIsLoading
      startActionTransition(async () => {
        setIsLoading(true);
        try {
          console.log("GamePage: Player clicked 'Yes, Play Again!'. Calling resetGameForTesting.");
          await resetGameForTesting(); // This action handles the redirect to /?step=setup
          // No client-side navigation needed here, server action handles it.
          // Toast can be shown, but user will be navigated away.
        } catch (error: any) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            console.log("GamePage (handlePlayAgainYes): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
            // Let Next.js handle the redirect, isLoading will reset on new page load
            return;
          } else {
            console.error("GamePage: Error on 'Play Again Yes':", error);
            toast({ title: "Reset Error", description: error.message || "Could not reset for new game.", variant: "destructive" });
            setIsLoading(false); // Set loading false if it's not a redirect
          }
        } 
        // If it wasn't a redirect and no error, still might be loading new page
        // but for safety, if we reach here, the action is "done" from client perspective
        // No, isLoading will be handled by the redirect and subsequent page load.
      });
    }
  };
  

  const handlePlayAgainNo = async () => {
    console.log("GamePage: Player clicked 'No, I'm Done'. Navigating to home.");
    router.push('/');
  };

  const handleResetGameFromGamePage = async () => {
    console.log("🔴 RESET (GamePage Client): Button clicked - calling resetGameForTesting server action.");
    startActionTransition(async () => {
      setIsLoading(true);
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("🔴 RESET (GamePage Client): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
          // isLoading will reset on new page load
        } else {
          console.error("🔴 RESET (GamePage Client): Error calling resetGameForTesting server action:", error);
          toast({
            title: "Reset Failed",
            description: `Could not reset the game. ${error.message || String(error)}`,
            variant: "destructive",
          });
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
     // User is on /game, but game is in lobby phase.
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="/logo.png" alt="Game Logo - Lobby" width={182} height={54} className="mb-6" data-ai-hint="game logo"/>
        <h1 className="text-4xl font-bold text-primary mb-4">Lobby is Empty or Game Not Started</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The game is currently in the lobby phase.
          {gameState.players.length >= MIN_PLAYERS_TO_START ? " Click 'Start Game Now!' to begin." : " Waiting for players..."}
        </p>
        {gameState.players.length >= MIN_PLAYERS_TO_START && (
          <Button onClick={handleStartGame} disabled={isActionPending} variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
            {isActionPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-2 h-6 w-6" />} 
            Start Game Now!
          </Button>
        )}
         <Link href="/?step=setup" className="mt-6">
            <Button variant="outline" size="sm">
                Go to Player Setup
            </Button>
        </Link>
      </div>
    );
  }

  // Specific loading state for when game is active but thisPlayer is not yet identified
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
    // This condition should ideally be caught by the "Identifying player..." screen above,
    // but as a fallback for rendering.
    if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
        if (['category_selection', 'player_submission', 'judging'].includes(gameState.gamePhase)) {
            return <div className="text-center text-destructive">Error: Could not identify your player for this game. Please return to lobby.</div>;
        }
    }

    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay 
                gameState={gameState} 
                onNextRound={handleNextRound} // Still used for timed transition on winner_announcement
                onPlayAgainYes={handlePlayAgainYes}
                onPlayAgainNo={handlePlayAgainNo}
              />;
    }
    if (thisPlayer?.isJudge) { 
      return <JudgeView gameState={gameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    if (thisPlayer && !thisPlayer.isJudge) { 
      return <PlayerView gameState={gameState} player={thisPlayer} />;
    }
    // Fallback if thisPlayer is somehow null but game is not in a state that handles it (e.g., spectating mode if we build that)
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Waiting for Game State</CardTitle></CardHeader>
            <CardContent><p>The game is in phase: {gameState.gamePhase}. Your role is being determined.</p></CardContent>
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
            disabled={isActionPending || isLoading} // Disable if any global loading or specific action pending
          >
            { (isLoading || isActionPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" /> } 
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
        {/* Removed the more aggressive isLoading overlay here to rely on the specific 'Identifying player' screen */}

        {thisPlayer && (
          <Card className="mb-4 bg-muted border-primary shadow">
            <CardContent className="p-3 flex items-center justify-center text-center">
              {thisPlayer.avatar.startsWith('/') ? (
                <Image 
                  src={thisPlayer.avatar} 
                  alt={`${thisPlayer.name}'s avatar`} 
                  width={28} // Slightly smaller for this context
                  height={28}
                  className="mr-2 rounded-md object-cover"
                />
              ) : (
                <span className="text-2xl mx-1">{thisPlayer.avatar}</span>
              )}
              <p className="text-sm text-primary font-medium">
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
