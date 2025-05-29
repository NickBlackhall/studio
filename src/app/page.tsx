
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, ThumbsUp, ThumbsDown, CheckSquare, XSquare } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START } from '@/lib/types'; // Added import
import CurrentYear from '@/components/CurrentYear';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils'; 

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams?.get('step'); // Use optional chaining

  const [game, setGame] = useState<GameClientState | null>(null);
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingAction, startTransition] = useTransition();
  const { toast } = useToast();

  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  
  const currentStep = stepParam === 'setup' ? 'setup' : 'welcome';

  const fetchGameData = useCallback(async (origin: string = "initial") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    setIsLoading(true);
    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, gameState ? `ID: ${gameState.gameId}, Phase: ${gameState.gamePhase}, Players: ${gameState.players.length}` : "null");
      setGame(gameState);
      if (gameState?.gameId) {
        const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameState.gameId}`);
        if (playerIdFromStorage) {
          setThisPlayerId(playerIdFromStorage);
        } else {
          setThisPlayerId(null);
        }
      }
    } catch (error: any) {
      console.error(`Client: Failed to fetch initial game state (from ${origin}):`, error);
      toast({ title: "Load Error", description: `Could not load game: ${error.message || String(error)}`, variant: "destructive"});
      setGame(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    console.log('Supabase client URL:', supabase.supabaseUrl);
    console.log('Supabase client Key (first 10 chars):', supabase.auth.getSession ? (supabase.auth.getSession() ? 'Session available' : 'No session method yet') : 'No getSession method');
    fetchGameData("useEffect[] mount");
  }, [fetchGameData]);

  useEffect(() => {
    if (!game || !game.gameId || isLoading) {
      console.log("Realtime or Redirect: No game, gameId, or still loading, skipping real-time setup on WelcomePage.");
      return;
    }
    const gameId = game.gameId;
    console.log(`Realtime: Setting up Supabase subscriptions on WelcomePage for gameId: ${gameId}`);

    const commonPayloadHandler = async (sourceTable: string, payload: any) => {
      console.log(`>>> Realtime (${sourceTable} sub for game ${gameId} on WelcomePage): CHANGE DETECTED! Payload:`, payload);
      try {
        const updatedGame = await getGame(gameId);
        console.log(`Realtime (${sourceTable} sub for game ${gameId} on WelcomePage): Updated game state from getGame():`, updatedGame ? `ID: ${updatedGame.gameId}, Phase: ${updatedGame.gamePhase}, Players: ${updatedGame.players.length}` : "null" );
        setGame(updatedGame); 
      } catch (error) {
        console.error(`Realtime (${sourceTable} sub for game ${gameId} on WelcomePage): Error fetching game state after ${sourceTable} update:`, error);
      }
    };
    
    const playersChannel = supabase
      .channel(`players-lobby-${game.gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${game.gameId}` },
        (payload: any) => {
            console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! (Lobby page for game ${game.gameId})`, payload);
            commonPayloadHandler('players', payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to players-lobby-${game.gameId} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (players-lobby-${game.gameId} on WelcomePage):`, status, err);
        }
         if (err) console.error(`Realtime: Subscription detailed error (players-lobby-${game.gameId} on WelcomePage):`, err);
      });

    const gameChannel = supabase
      .channel(`game-state-lobby-${game.gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.gameId}` },
         (payload: any) => {
          console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! (Lobby page for game ${game.gameId})`, payload);
          commonPayloadHandler('games', payload);
         }
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to game-state-lobby-${game.gameId} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (game-state-lobby-${game.gameId} on WelcomePage):`, status, err);
        }
        if (err) console.error(`Realtime: Subscription detailed error (game-state-lobby-${game.gameId} on WelcomePage):`, err);
      });

    return () => {
      console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${game?.gameId || 'N/A'} (WelcomePage unmount/re-effect)`);
      supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
      supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
    };
  }, [game, isLoading]);


  useEffect(() => {
    const activePlayingPhases: GamePhaseClientState[] = ['category_selection', 'player_submission', 'judging'];
    
    if (game && activePlayingPhases.includes(game.gamePhase) && currentStep === 'setup' && !isLoading && !hasAutoNavigated) {
        console.log(`Client: Game phase is ${game.gamePhase} (active), step is 'setup'. Auto-navigating to /game.`);
        setHasAutoNavigated(true); 
        setTimeout(() => {
            router.push('/game');
        }, 100); 
    }

    if (game && game.gamePhase === 'lobby' && hasAutoNavigated) {
        console.log("Client: Game returned to lobby. Resetting auto-navigation flag.");
        setHasAutoNavigated(false);
    }
  }, [game, currentStep, isLoading, router, hasAutoNavigated]);


  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;

    if (!name.trim() || !avatar) {
        toast({ title: "Missing Info", description: "Please enter your name and select an avatar.", variant: "destructive" });
        return;
    }
    if (!game || !game.gameId) {
        console.error("Client: Cannot add player: gameId is not available on client state.");
        toast({ title: "Error!", description: "Game session not found. Please refresh.", variant: "destructive"});
        return;
    }

    const currentLocalGameId = game.gameId;
    console.log(`Client: Attempting to add player ${name} (avatar: ${avatar}) for gameId ${currentLocalGameId}`);
    startTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && currentLocalGameId) {
          const localStorageKey = `thisPlayerId_game_${currentLocalGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          console.log(`Client: Player ID ${newPlayer.id} stored in localStorage with key ${localStorageKey}`);
          
          // Re-fetch is now handled by real-time or the commonPayloadHandler if needed
          // For immediate feedback on the current client:
          const updatedGame = await getGame(currentLocalGameId); 
          setGame(updatedGame);
          console.log("Client (handleAddPlayer): Game state after adding player (direct fetch for current client):", updatedGame ? `ID: ${updatedGame.gameId}, Phase: ${updatedGame.gamePhase}, Players: ${updatedGame.players.length}` : "null");
          toast({ title: "Welcome!", description: `${name} has joined. Click 'Ready' when you are!` });
          
        } else {
          console.error("Client: Failed to add player or set player ID in localStorage.", { newPlayer, gameId: currentLocalGameId });
          toast({ title: "Error!", description: "Could not add player or save session. Please try again.", variant: "destructive"});
        }
      } catch (error: any) {
          console.error("Client: Error calling addPlayerAction:", error);
          const errorMsg = error.message || String(error);
          toast({ title: "Error Adding Player", description: errorMsg, variant: "destructive"});
      }
    });
  };

 const handleResetGame = async () => {
    console.log("🔴 RESET (Client): Button clicked - calling resetGameForTesting server action.");
    setIsLoading(true); 
    try {
      await resetGameForTesting();
      console.log("🔴 RESET (Client): resetGameForTesting server action likely initiated redirect.");
    } catch (error: any) {
       if (error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
        console.log("🔴 RESET (Client): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
      } else {
        console.error("🔴 RESET (Client): Error calling resetGameForTesting server action:", error);
        toast({
          title: "Reset Failed",
          description: `Could not reset the game. ${error.message || String(error)}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    if (!game || !game.gameId || !thisPlayerId) {
        console.warn("Client: Cannot toggle ready. No game, gameId, or thisPlayerId is not set.", { game, player, thisPlayerId });
        return;
    }
    if (player.id !== thisPlayerId) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    console.log(`Client: Toggling ready status for player ${player.name} (ID: ${player.id}) from ${player.isReady} for game ${game.gameId}`);
    startTransition(async () => {
      try {
        await togglePlayerReadyStatus(player.id, game.gameId, player.isReady); 
        toast({
          title: player.isReady ? "Status: Not Ready" : "Status: Ready!",
          description: `You've changed your ready status.`,
        });
      } catch (error: any) {
        console.error("Client: Error toggling ready status:", error);
        toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
      }
    });
  };


  if (isLoading && !game) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Game...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Image src="/logo.png" alt="Make It Terrible Logo" width={219} height={65} data-ai-hint="game logo" />
        <p className="text-xl text-destructive mt-4">Could not load game data. Please try refreshing.</p>
        <p className="text-sm text-muted-foreground mt-2">Check browser console and server logs for errors.</p>
         <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }
  
  const activePlayingPhases: GamePhaseClientState[] = ['category_selection', 'player_submission', 'judging'];

  if (currentStep === 'setup') {
    const allPlayersReady = game.players.length >= MIN_PLAYERS_TO_START && game.players.every(p => p.isReady);
    const enoughPlayers = game.players.length >= MIN_PLAYERS_TO_START;
    const gameIsActuallyPlaying = activePlayingPhases.includes(game.gamePhase);

    let lobbyMessage = "";
    if (game.gamePhase === 'lobby') {
      if (!enoughPlayers) {
        lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players to start. Waiting for ${MIN_PLAYERS_TO_START - game.players.length} more...`;
      } else if (!allPlayersReady) {
        const unreadyCount = game.players.filter(p => !p.isReady).length;
        lobbyMessage = `Waiting for ${unreadyCount} more player${unreadyCount > 1 ? 's' : ''} to be ready...`;
      } else {
        lobbyMessage = "All players ready! Starting game..."; // Game should auto-start via server action
      }
    }


    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => { setHasAutoNavigated(false); router.push('/'); }} className="cursor-pointer">
            <Image
              src="/logo.png"
              alt="Make It Terrible Logo"
              width={438}
              height={131}
              className="mx-auto mb-4"
              data-ai-hint="game logo large"
              priority
            />
          </button>
          <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
          {gameIsActuallyPlaying &&
            <div className="my-4 p-4 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md shadow-lg">
                <p className="font-bold text-lg">Game in Progress!</p>
                <p className="text-md">The current game is in the "{game.gamePhase}" phase.</p>
                 <Button
                    onClick={() => router.push('/game')}
                    variant="default" 
                    size="lg" 
                    className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90" 
                >
                    Go to Current Game <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
          }
          {(!gameIsActuallyPlaying && game.gamePhase === 'lobby') &&
            <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then click "Ready" to play!</p>
          }
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {(!gameIsActuallyPlaying && game.gamePhase === 'lobby') && (
            <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your poison (avatar).</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <PlayerSetupForm addPlayer={handleAddPlayer} />
              </CardContent>
            </Card>
          )}
          {gameIsActuallyPlaying && ( 
             <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 md:col-span-2">
                <p className="text-center text-lg text-foreground mb-4">A game is already in progress in phase: "{game.gamePhase}".</p>
                <p className="text-center text-sm text-muted-foreground mb-4">You can join the next game once this one finishes.</p>
                <Button onClick={() => router.push('/game')} variant="default" size="lg" className="mb-4 bg-accent text-accent-foreground hover:bg-accent/90">
                   <Play className="mr-2 h-5 w-5" /> Go to Current Game (Spectate)
                </Button>
             </Card>
          )}

          <Card className="shadow-2xl border-2 border-secondary rounded-xl overflow-hidden">
            <CardHeader className="bg-secondary text-secondary-foreground p-6">
              <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby ({game.players.length})</CardTitle>
              <CardDescription className="text-secondary-foreground/80 text-base">
                {game.gamePhase === 'lobby' ? "Click the button to ready up! Game starts automatically when all are ready." : "Current players in game."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {game.players.length > 0 ? (
                <ul className="space-y-3">
                  {game.players.map((player: PlayerClientState) => (
                    <li key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg shadow">
                      <div className="flex items-center">
                        <span className="text-4xl mr-4">{player.avatar}</span>
                        <span className="text-xl font-medium text-foreground">{player.name}</span>
                      </div>
                      {game.gamePhase === 'lobby' && (
                        <div className="flex items-center space-x-2">
                          {player.id === thisPlayerId ? (
                            <Button 
                              onClick={() => handleToggleReady(player)} 
                              variant={player.isReady ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "px-3 py-1 text-xs", 
                                player.isReady 
                                  ? "bg-green-500 hover:bg-green-600 text-white" 
                                  : "border-primary text-primary hover:bg-primary/10"
                                )}
                              disabled={isPendingAction}
                            >
                              {isPendingAction && game.players.find(p => p.id === thisPlayerId)?.isReady !== player.isReady ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (player.isReady ? <ThumbsUp className="mr-1 h-3 w-3"/> : <ThumbsDown className="mr-1 h-3 w-3"/>)}
                              {player.isReady ? "Ready!" : "Not Ready"}
                            </Button>
                          ) : (
                            player.isReady ? <CheckSquare className="h-6 w-6 text-green-500" title="Ready" /> : <XSquare className="h-6 w-6 text-red-500" title="Not Ready" />
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-center py-4">No players yet. Be the first to cause some trouble!</p>
              )}
              {game.gamePhase === 'lobby' && lobbyMessage && (
                 <p className="text-sm text-center mt-4 text-yellow-600 dark:text-yellow-400 animate-pulse font-semibold">{lobbyMessage}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 w-full max-w-4xl text-center">
          <Button
            onClick={handleResetGame}
            variant="destructive"
            size="sm"
            className="hover:bg-destructive/80"
            disabled={isPendingAction} 
          >
            {isPendingAction && game?.gamePhase !== 'lobby' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game State (For Testing)
          </Button>
        </div>

         <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground text-center">
      <Image
        src="/logo.png"
        alt="Make It Terrible Logo"
        width={438}
        height={131}
        className="mx-auto mb-8"
        data-ai-hint="game logo large"
        priority
      />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">
        Make It Terrible
      </h1>
      <p className="text-2xl text-muted-foreground mb-12">
        The game of awful choices and hilarious outcomes!
      </p>
       <Button
          onClick={() => router.push('/?step=setup')}
          variant="default"
          size="lg"
          className="bg-accent text-accent-foreground hover:bg-accent/90 text-2xl px-10 py-8 font-bold shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out"
        >
          Join the Mayhem <ArrowRight className="ml-3 h-7 w-7" />
        </Button>
       <footer className="absolute bottom-8 text-center text-sm text-muted-foreground w-full">
        <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
      </footer>
    </div>
  );
}
