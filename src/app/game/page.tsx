
"use client"; 

import { useEffect, useState, useTransition, useCallback } from 'react';
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
  resetGameForTesting // Import reset action
} from '@/app/game/actions';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, UserCircle, RefreshCw } from 'lucide-react'; // Import RefreshCw
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';


export default function GamePage() {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, startActionTransition] = useTransition(); 
  const router = useRouter();
  const { toast } = useToast();

  const fetchGameAndPlayer = useCallback(async (origin: string = "unknown") => {
    console.log(`GamePage: fetchGameAndPlayer called from ${origin}.`);
    setIsLoading(true);
    let localGameId: string | null = null;
    try {
      const initialGameState = await getGame();
      setGameState(initialGameState);
      console.log(`GamePage: GameState fetched (from ${origin}):`, initialGameState ? `ID: ${initialGameState.gameId}, Phase: ${initialGameState.gamePhase}, Players: ${initialGameState.players.length}` : "null");

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
            console.log(`GamePage: Player ${playerIdFromStorage} NOT in initial game state. Attempting direct fetch for game ${localGameId}.`);
            const playerDetail = await getCurrentPlayer(playerIdFromStorage, localGameId);
            setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
            console.log(`GamePage: Fetched thisPlayer details directly (from ${origin}):`, playerDetail ? playerDetail.id : "null");
          }
        } else {
          console.warn(`GamePage: No player ID found in localStorage for game ${localGameId}. thisPlayer will be null.`);
          setThisPlayer(null);
        }
      } else if (initialGameState && initialGameState.gamePhase === 'lobby' && initialGameState.players.length === 0) {
        console.log("GamePage: Lobby is empty or no gameId, redirecting to setup.");
        router.push('/?step=setup');
        return;
      }
    } catch (error) {
      console.error(`GamePage: Error in fetchGameAndPlayer (from ${origin}):`, error);
      toast({ title: "Error Loading Game", description: "Could not fetch game data. Please try refreshing.", variant: "destructive" });
      setThisPlayer(null);
    } finally {
      setIsLoading(false);
      console.log(`GamePage: fetchGameAndPlayer (from ${origin}) sequence ended.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, toast]); // Removed toast from deps as it should be stable, router for push

  useEffect(() => {
    fetchGameAndPlayer("initial mount");
  }, [fetchGameAndPlayer]);

  useEffect(() => {
    if (!gameState || !gameState.gameId || !thisPlayer?.id) {
      console.log(`GamePage Realtime: Skipping player-specific subscription setup (no game/gameId/thisPlayerId).`);
    }
    
    if (!gameState || !gameState.gameId) {
      console.log("GamePage Realtime: Skipping general subscription setup (no game/gameId). Current gameState:", gameState);
      return;
    }
    const gameId = gameState.gameId;
    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}`);

    const commonPayloadHandler = async (originTable: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${originTable} sub for game ${gameId}): CHANGE DETECTED!`, payload);
      startActionTransition(async () => {
        try {
          const updatedFullGame = await getGame(gameId);
          setGameState(updatedFullGame);
          console.log(`GamePage Realtime: Game state updated from ${originTable} event. GameID: ${updatedFullGame?.gameId}, Phase: ${updatedFullGame?.gamePhase}, Players: ${updatedFullGame?.players?.length}`);
          
          if (thisPlayer?.id && updatedFullGame?.gameId) {
            if (updatedFullGame.gameId === gameId) { // Ensure it's the same game
              const latestPlayerDetails = await getCurrentPlayer(thisPlayer.id, updatedFullGame.gameId);
              setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
              console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
            } else {
               console.warn(`GamePage Realtime: Game ID mismatch. Current: ${gameId}, Updated: ${updatedFullGame.gameId}. Not refreshing thisPlayer.`);
            }
          }
        } catch (error) {
          console.error(`GamePage Realtime: Error processing ${originTable} update for game ${gameId}:`, error);
        }
      });
    };

    const channels = [
      { name: 'game-updates', table: 'games', filter: `id=eq.${gameId}`, event: 'UPDATE' },
      { name: 'players-updates', table: 'players', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'player-hands-updates', table: 'player_hands', filter: `game_id=eq.${gameId}`, event: '*' },
      { name: 'submissions-updates', table: 'responses', filter: `game_id=eq.${gameId}`, event: '*' }
    ];

    const activeSubscriptions = channels.map(channelConfig => {
      const channel = supabase
        .channel(`${channelConfig.name}-${gameId}`)
        .on('postgres_changes', { 
            event: channelConfig.event as any, 
            schema: 'public', 
            table: channelConfig.table, 
            filter: channelConfig.filter 
          },
          (payload) => commonPayloadHandler(channelConfig.table, payload)
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to ${channelConfig.name}-${gameId}`);
          if (err) console.error(`GamePage Realtime: Error on ${channelConfig.name}-${gameId} subscription:`, err);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`GamePage Realtime: Channel error for ${channelConfig.name}-${gameId}: ${status}`, err);
          }
        });
      return channel;
    });

    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}`);
      activeSubscriptions.forEach(sub => supabase.removeChannel(sub).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.gameId, thisPlayer?.id]); // Added thisPlayer?.id to re-evaluate if player changes


  const handleStartGame = async () => {
    if (gameState?.gameId && gameState.gamePhase === 'lobby') {
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
      toast({title: "Cannot Start", description: `Game not in lobby phase (current: ${gameState?.gamePhase}) or no game ID.`, variant: "destructive"})
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
      setIsLoading(true); 
      try {
        await nextRound(gameState.gameId);
      } catch (error: any) {
        console.error("GamePage: Error starting next round:", error);
        if (error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("GamePage (handleNextRound): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
        } else {
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
      } finally {
        // Only set loading to false if it wasn't a redirect that unmounts the component.
        // If it was a redirect, the component unmounts. If not, ensure loading is false.
        // A simple check: if there's an error and it's not a redirect error, stop loading.
        // If no error, assume state update or redirect handles UI.
        if (error && !(typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))) {
            setIsLoading(false); 
        } else if (!error) {
            // If no error and no redirect, we might need to set isLoading to false here if the component
            // doesn't always unmount or refresh quickly enough through other means.
            // For now, relying on redirect or realtime to refresh.
            // However, if the action was *not* a game-over redirect, we might want to ensure isLoading is false.
            // This path implies a normal "next round", state should update via realtime.
            setIsLoading(false); 
        }
      }
    }
  };

  const handleResetGameFromGamePage = async () => {
    console.log("🔴 RESET (GamePage Client): Button clicked - calling resetGameForTesting server action.");
    // No startTransition here, to allow redirect to happen cleanly
    setIsLoading(true);
    try {
      await resetGameForTesting();
      // Redirect is handled by the server action
    } catch (error: any) {
      if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
        console.log("🔴 RESET (GamePage Client): Caught NEXT_REDIRECT during reset. Allowing Next.js to handle navigation.");
        // This is an expected part of the flow, do not toast.
      } else {
        console.error("🔴 RESET (GamePage Client): Error calling resetGameForTesting server action:", error);
        toast({
          title: "Reset Failed",
          description: `Could not reset the game. ${error.message || String(error)}`,
          variant: "destructive",
        });
      }
    } finally {
      // If not a redirect error, ensure loading is false.
      if (!(error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))) {
        setIsLoading(false);
      }
    }
  };


  if (isLoading && (!gameState || (!thisPlayer && (gameState?.gamePhase !== 'winner_announcement' && gameState?.gamePhase !== 'game_over'))) ) {
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
        <Image src="https://placehold.co/150x150.png?text=Uh+Oh!" alt="Error" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="error warning"/>
        <h1 className="text-4xl font-bold text-destructive mb-4">Critical Game Error!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Could not load or initialize the game session. Please try again or reset.
        </p>
        <Link href="/">
          <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Welcome Page
          </Button>
        </Link>
      </div>
    );
  }
  
  if (gameState.gamePhase === 'lobby') {
     return (
         <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image 
              src={gameState.players.length >= 2 ? "https://placehold.co/150x150.png?text=Ready%3F" : "https://placehold.co/150x150.png?text=Waiting"} 
              alt={gameState.players.length >= 2 ? "Ready to play" : "Waiting for players"} 
              width={150} height={150} className="mb-6 rounded-lg shadow-md" 
              data-ai-hint={gameState.players.length >= 2 ? "game start" : "waiting players"}
            />
            <h1 className="text-4xl font-bold text-primary mb-4">
              {gameState.players.length >= 2 ? "Ready to Make it Terrible?" : (gameState.players.length === 0 ? "Lobby is Empty" : "Waiting for More Players...")}
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
            {gameState.players.length > 0 ? `${gameState.players.length} players are in the lobby.` : "Add players from the main page."}
            {gameState.players.length > 0 && (gameState.players.length >= 2 ? " Let the chaos begin!" : " Need at least 2 to start.")}
            </p>
            {gameState.players.length >= 2 && (
                <Button onClick={handleStartGame} disabled={isActionPending} variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
                    {isActionPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-2 h-6 w-6" />} 
                    Start Game Now!
                </Button>
            )}
            {gameState.players.length > 0 && (
              <div className="mt-8 w-full max-w-md">
                <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
              </div>
            )}
             <Link href="/?step=setup" className="mt-6">
                <Button variant="outline" size="sm">
                    {gameState.players.length === 0 ? "Go to Player Setup" : "Back to Main Lobby"}
                </Button>
            </Link>
        </div>
    );
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

  const isJudge = thisPlayer?.id === gameState.currentJudgeId;

  const renderGameContent = () => {
    if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
        if (['lobby', 'category_selection', 'player_submission', 'judging'].includes(gameState.gamePhase)) {
            return <div className="text-center text-destructive">Error: Could not identify your player for this game. Please return to lobby.</div>;
        }
    }

    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay gameState={gameState} onNextRound={handleNextRound} />;
    }
    if (isJudge && thisPlayer) {
      return <JudgeView gameState={gameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    if (!isJudge && thisPlayer) {
      return <PlayerView gameState={gameState} player={thisPlayer} />;
    }
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Spectating</CardTitle></CardHeader>
            <CardContent><p>The game is in progress. Current phase: {gameState.gamePhase}</p></CardContent>
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
            disabled={isLoading || isActionPending} // Disable while other actions or loading is in progress
          >
            { (isLoading && !isActionPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" /> } 
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
        {isLoading && (!gameState || (!thisPlayer && gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) && (
            <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-50 rounded-lg">
                 <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        )}

        {thisPlayer && (
          <Card className="mb-4 bg-muted border-primary shadow">
            <CardContent className="p-3 flex items-center justify-center text-center">
              <UserCircle className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm text-primary font-medium">
                You are: <span className="text-2xl mx-1">{thisPlayer.avatar}</span><strong>{thisPlayer.name}</strong>
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
    

    