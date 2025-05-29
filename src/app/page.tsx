
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, getPlayersInGame } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, ThumbsUp, ThumbsDown, CheckSquare, XSquare } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import CurrentYear from '@/components/CurrentYear';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStepQueryParam = searchParams?.get('step') || 'welcome';

  const [game, setGame] = useState<GameClientState | null>(null);
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const [currentStep, setCurrentStep] = useState(currentStepQueryParam);

  useEffect(() => {
    setCurrentStep(searchParams?.get('step') || 'welcome');
  }, [searchParams]);


  const fetchGameData = useCallback(async (origin: string = "unknown") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    // Set isLoading to true only if it's not already true, to avoid loops if called rapidly
    // This is primarily for the initial load. Subsequent fetches might be handled differently.
    // setIsLoading(true); // Problematic if isLoading itself is a dep that causes re-fetch

    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, gameState ? `ID: ${gameState.gameId}, Phase: ${gameState.gamePhase}, Players: ${gameState.players.length}, isLoading: ${isLoading}` : "null", `isLoading: ${isLoading}`);
      if (isMountedRef.current) {
        setGame(gameState);
        if (gameState?.gameId) {
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameState.gameId}`);
          if (playerIdFromStorage) {
            const playerInGame = gameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGame) {
              setThisPlayerId(playerIdFromStorage);
            } else {
              localStorage.removeItem(`thisPlayerId_game_${gameState.gameId}`);
              setThisPlayerId(null);
            }
          } else {
            setThisPlayerId(null);
          }
        } else {
          setThisPlayerId(null);
        }
      }
    } catch (error: any) {
      console.error(`Client: Failed to fetch initial game state (from ${origin}):`, error);
      if (isMountedRef.current) {
        toast({ title: "Load Error", description: `Could not load game: ${error.message || String(error)}`, variant: "destructive"});
        setGame(null);
        setThisPlayerId(null);
      }
    } finally {
      if (isMountedRef.current) {
         setIsLoading(false);
      }
    }
  }, [toast]); // Removed isLoading from dependencies, isMountedRef will be used for safety

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true); // Set loading true when component mounts or step changes
    fetchGameData(`useEffect[] mount or step change to: ${currentStep}`);
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchGameData, currentStep]); // fetchGameData is stable, currentStep is the key trigger


  useEffect(() => {
    const gameId = game?.gameId;

    if (!gameId || isLoading) {
      console.log(`Realtime or Redirect: No gameId, or still loading, skipping setup. Game ID: ${gameId || 'N/A'}, isLoading: ${isLoading} on WelcomePage (currentStep: ${currentStep})`);
      return;
    }

    console.log(`Realtime: Setting up Supabase subscriptions on WelcomePage for gameId: ${gameId}`);

    const handlePlayersUpdate = async (payload: any) => {
      console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      if (game?.gameId) {
        console.log(`Realtime (players sub for game ${game.gameId}): Fetching updated player list...`);
        const newPlayersList = await getPlayersInGame(game.gameId);
        if (newPlayersList && isMountedRef.current) {
          setGame(prevGame_1 => {
            if (!prevGame_1) return null;
            console.log(`Realtime (players sub for game ${prevGame_1.gameId}): Updated player list from getPlayersInGame(). New count: ${newPlayersList.length}`);
            return { ...prevGame_1, players: newPlayersList };
          });
        }
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      if (game?.gameId) {
        console.log(`Realtime (games sub for game ${game.gameId}): Fetching updated game state due to games change...`);
        const updatedFullGame = await getGame(game.gameId);
        if (updatedFullGame && isMountedRef.current) {
           setGame(updatedFullGame);
           // If game phase changes to active while in lobby, auto-navigate
           if (updatedFullGame.gamePhase !== 'lobby' && ACTIVE_PLAYING_PHASES.includes(updatedFullGame.gamePhase as GamePhaseClientState) && currentStep === 'setup') {
             console.log(`Client: Game phase changed to ${updatedFullGame.gamePhase} (active) via Realtime, step is 'setup'. Auto-navigating to /game.`);
             setTimeout(() => router.push('/game'), 0); // Deferred navigation
           }
        }
      }
    };

    const uniqueChannelSuffix = thisPlayerId || Date.now();

    const playersChannel = supabase
      .channel(`players-lobby-${gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        handlePlayersUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to players-lobby-${gameId} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (players-lobby-${gameId}):`, status, err);
        }
         if (err) {
            console.error(`Realtime: Subscription detailed error (players-lobby-${gameId}):`, err);
         }
      });

    const gameChannel = supabase
      .channel(`game-state-lobby-${gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        handleGameTableUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to game-state-lobby-${gameId} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (game-state-lobby-${gameId}):`, status, err);
        }
        if (err) {
          console.error(`Realtime: Subscription detailed error (game-state-lobby-${gameId}):`, err);
        }
      });
      
    return () => {
      console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${gameId} on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
      supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
      supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
    };
  }, [game?.gameId, fetchGameData, router, currentStep, isLoading, thisPlayerId, toast]); // Depend on game?.gameId

  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;

    if (!name.trim() || !avatar) {
        toast({ title: "Missing Info", description: "Please enter your name and select an avatar.", variant: "destructive" });
        return;
    }
    if (!game || !game.gameId) {
        toast({ title: "Error!", description: "Game session not found. Please refresh.", variant: "destructive"});
        if (isMountedRef.current) await fetchGameData("handleAddPlayer_no_gameId");
        return;
    }

    console.log(`Client: Attempting to add player ${name} (avatar: ${avatar}) for gameId ${game.gameId}`);
    startPlayerActionTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && game?.gameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${game.gameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          console.log(`Client: Player ID ${newPlayer.id} stored in localStorage with key ${localStorageKey}`);
          
          const updatedPlayersList = await getPlayersInGame(game.gameId);
          if (updatedPlayersList && isMountedRef.current) {
            setGame(prevGame => ({ ...prevGame!, players: updatedPlayersList }));
            console.log("Client (handleAddPlayer): Player list updated for initiating client.");
          }
        } else if (isMountedRef.current) {
          toast({ title: "Error Adding Player", description: "Could not add player or save session. Please try again.", variant: "destructive"});
        }
      } catch (error: any) {
        console.error("Client: Error calling addPlayerAction:", error);
        if (isMountedRef.current) {
          const errorMsg = error.message || String(error);
          toast({ title: "Error Adding Player", description: errorMsg, variant: "destructive"});
        }
      }
    });
  };

  const handleResetGame = async () => {
    console.log("🔴 RESET (Client): Button clicked - calling resetGameForTesting server action.");
    setIsLoading(true); // Show loading state
    try {
      await resetGameForTesting();
      // Redirect is handled by the server action. The page will reload.
      // Client state (thisPlayerId, game) will be reset by fetchGameData on reload.
      console.log("🔴 RESET (Client): resetGameForTesting server action called. Page should redirect and reload.");
    } catch (error: any) {
      if (isMountedRef.current) {
        setIsLoading(false); // Hide loading state on error
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("🔴 RESET (Client): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          // Let Next.js handle the redirect
        } else {
          console.error("🔴 RESET (Client): Error calling resetGameForTesting server action:", error);
          toast({
            title: "Reset Failed",
            description: `Could not reset the game. ${error.message || String(error)}`,
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    if (!game || !game.gameId || !thisPlayerId) {
        toast({ title: "Error", description: "Cannot change ready status. Game or player not identified.", variant: "destructive" });
        return;
    }
    if (player.id !== thisPlayerId) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    console.log(`Client: Toggling ready status for player ${player.name} (ID: ${player.id}) from ${player.isReady} for game ${game.gameId}`);
    startPlayerActionTransition(async () => {
      try {
        await togglePlayerReadyStatus(player.id, game.gameId);
        // Realtime updates should handle UI changes for all clients
      } catch (error: any) {
        console.error("Client: Error toggling ready status:", error);
        if (isMountedRef.current) {
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };


  if (isLoading || !game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Game...</p>
      </div>
    );
  }
  
  if (!game.gameId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Image src="/logo.png" alt="Make It Terrible Logo" width={365} height={109} className="mx-auto" data-ai-hint="game logo" priority />
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const thisPlayerObject = game.players.find(p => p.id === thisPlayerId);
  const gameIsActive = ACTIVE_PLAYING_PHASES.includes(game.gamePhase as GamePhaseClientState);


  if (currentStep === 'setup') {
    if (!game.players) { 
      return (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading player list...</p>
        </div>
      );
    }
    
    const enoughPlayers = game.players.length >= MIN_PLAYERS_TO_START;
    const allPlayersReady = enoughPlayers && game.players.every(p => p.isReady);

    let lobbyMessage = "";
    if (game.gamePhase === 'lobby') {
      if (!enoughPlayers) {
        lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players to start. Waiting for ${MIN_PLAYERS_TO_START - game.players.length} more...`;
      } else if (!allPlayersReady) {
        const unreadyCount = game.players.filter(p => !p.isReady).length;
        lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to be ready... Game will start automatically.`;
      } else {
        // Game starts automatically, this message might only flash briefly
        lobbyMessage = "All players ready! Starting game...";
      }
    }

    const showPlayerSetupForm = !thisPlayerObject && game.gamePhase === 'lobby';
    const playerHasJoinedAndInLobby = thisPlayerObject && game.gamePhase === 'lobby';


    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => router.push('/?step=welcome')} className="cursor-pointer">
            <Image
              src="/logo.png"
              alt="Make It Terrible Logo"
              width={200} 
              height={59}  
              className="mx-auto mb-4"
              data-ai-hint="game logo"
              priority
            />
          </button>
          <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
           {gameIsActive && (
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
          )}
          {showPlayerSetupForm &&
            <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then click your ready button!</p>
          }
           {playerHasJoinedAndInLobby && !gameIsActive && (
            <p className="text-xl text-muted-foreground mt-2">
              Welcome, {thisPlayerObject?.name}! Click your 'Ready' button below. Game starts when all are ready.
            </p>
          )}
        </header>
        
        <div className={cn(
            "grid gap-8 w-full max-w-4xl",
             (showPlayerSetupForm || gameIsActive) ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1" 
        )}>
          {showPlayerSetupForm && (
            <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your avatar.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <PlayerSetupForm addPlayer={handleAddPlayer} />
              </CardContent>
            </Card>
          )}
          
          {(!showPlayerSetupForm || gameIsActive) && (
             <Card className={cn(
                "shadow-2xl border-2 border-secondary rounded-xl overflow-hidden",
                (!showPlayerSetupForm && !gameIsActive && playerHasJoinedAndInLobby) || (gameIsActive && thisPlayerObject) ? "md:col-span-2" : ""
             )}>
              <CardHeader className="bg-secondary text-secondary-foreground p-6">
                <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby ({game.players.length})</CardTitle>
                 <CardDescription className="text-secondary-foreground/80 text-base">
                  {game.gamePhase === 'lobby' ? "Game starts automatically when all players are ready." : `Current game phase: ${game.gamePhase}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {game.players.length > 0 ? (
                  <ul className="space-y-3">
                    {game.players.map((player: PlayerClientState) => (
                      <li key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg shadow">
                        <div className="flex items-center">
                          {player.avatar.startsWith('/') ? (
                            <Image
                              src={player.avatar}
                              alt={`${player.name}'s avatar`}
                              width={40}
                              height={40}
                              className="mr-3 rounded-sm object-contain"
                            />
                          ) : (
                            <span className="text-3xl mr-3">{player.avatar}</span>
                          )}
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
                                  "px-3 py-1 text-xs font-semibold",
                                  player.isReady
                                    ? "bg-green-500 hover:bg-green-600 text-white border-green-600"
                                    : "border-primary text-primary hover:bg-primary/10"
                                  )}
                                disabled={isProcessingAction}
                              >
                                {isProcessingAction ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (player.isReady ? <ThumbsUp className="mr-1 h-3 w-3"/> : <ThumbsDown className="mr-1 h-3 w-3"/>)}
                                {player.isReady ? "Ready!" : "Click to Ready"}
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
                   <p className="text-sm text-center mt-4 text-yellow-600 dark:text-yellow-400 font-semibold">{lobbyMessage}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 w-full max-w-4xl text-center">
          <Button
            onClick={handleResetGame}
            variant="destructive"
            size="sm"
            className="hover:bg-destructive/80"
            disabled={isProcessingAction || isLoading }
          >
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game State (For Testing)
          </Button>
        </div>

         <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
        </footer>
      </div>
    );
  }

  // Welcome Screen (currentStep === 'welcome')
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground text-center">
      <Image
        src="/logo.png"
        alt="Make It Terrible Logo"
        width={365}
        height={109}
        className="mx-auto mb-8"
        data-ai-hint="game logo"
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

    