
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, ThumbsUp, ThumbsDown, CheckSquare, XSquare } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
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
  
  const [game, setGame] = useState<GameClientState | null>(null);
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  
  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';

  console.log("Supabase client URL:", supabase.supabaseUrl);
  console.log("Supabase client Key (first 10 chars):", supabase.supabaseKey.substring(0,10));

  const fetchGameData = useCallback(async (origin: string = "unknown") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    if (!isMountedRef.current) return;
    setIsLoading(true);

    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, gameState ? `ID: ${gameState.gameId}, Phase: ${gameState.gamePhase}, Players: ${gameState.players.length}` : "null");
      
      if (isMountedRef.current) {
        setGame(gameState); // Set game state first

        if (gameState && gameState.gameId) {
          const localStorageKey = `thisPlayerId_game_${gameState.gameId}`;
          
          if (gameState.players.length === 0) {
            // If the fetched game state has NO players, forcefully clear this client's identity for this game
            console.log(`Client: Fetched game state shows 0 players for game ${gameState.gameId}. Forcefully clearing localStorage and thisPlayerId (from ${origin}).`);
            localStorage.removeItem(localStorageKey);
            setThisPlayerId(null);
          } else {
            // Original logic to check if stored player ID is in the fetched list
            const playerIdFromStorage = localStorage.getItem(localStorageKey);
            console.log(`Client: For gameId ${gameState.gameId}, player ID from storage: ${playerIdFromStorage} (from ${origin}).`);
            if (playerIdFromStorage) {
              const playerInGame = gameState.players.find(p => p.id === playerIdFromStorage);
              if (playerInGame) {
                setThisPlayerId(playerIdFromStorage);
                console.log(`Client: Player ${playerIdFromStorage} found in game.players list (from ${origin}).`);
              } else {
                console.warn(`Client: Player ${playerIdFromStorage} NOT in game.players list for game ${gameState.gameId}. Clearing localStorage (from ${origin}).`);
                localStorage.removeItem(localStorageKey);
                setThisPlayerId(null);
              }
            } else {
              console.log(`Client: No player ID found in localStorage for game ${gameState.gameId} (from ${origin}).`);
              setThisPlayerId(null);
            }
          }
          console.log(`Client: thisPlayerId ultimately set to: ${localStorage.getItem(localStorageKey) || thisPlayerId || null} after fetch from ${origin}.`);
        } else {
          // No game or gameId, so no player identity
          setThisPlayerId(null);
          if (gameState === null && origin !== "initial mount" && origin !== "useEffect[] mount or currentStep change to: setup") { // Avoid spam on initial load if game is truly new
             console.warn(`Client: Game state is null or no gameId from fetchGameData (origin: ${origin}). thisPlayerId set to null.`);
          }
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
  }, [toast]); // Removed router from dependencies as it's stable, added thisPlayerId for logging

  useEffect(() => {
    isMountedRef.current = true;
    fetchGameData(`useEffect[] mount or currentStep change to: ${currentStep}`);
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchGameData, currentStep]);


  useEffect(() => {
    if (!game || !game.gameId || isLoading) {
      console.log(`Realtime or Redirect: No game, gameId, or still loading, skipping setup. Game ID: ${game?.gameId || 'N/A'}, isLoading: ${isLoading} on WelcomePage (currentStep: ${currentStep})`);
      return () => {};
    }

    console.log(`Realtime: Setting up Supabase subscriptions for gameId: ${game.gameId} on WelcomePage (currentStep: ${currentStep}), thisPlayerId: ${thisPlayerId}`);
    const uniqueChannelSuffix = thisPlayerId || Date.now();

    const handlePlayersUpdate = async (payload: any) => {
      console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      if (isMountedRef.current && game?.gameId) {
        console.log(`Realtime (players sub for game ${game.gameId}): Fetching updated game state due to players change...`);
        await fetchGameData(`players-lobby-${game.gameId} player change`);
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      if (isMountedRef.current && game?.gameId) {
        console.log(`Realtime (games sub for game ${game.gameId}): Fetching updated game state due to games change...`);
        const updatedFullGame = await getGame(game.gameId);
        if (updatedFullGame && isMountedRef.current) {
           setGame(updatedFullGame); // Directly set game from this fetch
           // The logic to redirect if game phase changes out of lobby is now implicitly handled
           // by fetchGameData updating `game` state, and the main render logic checking `game.gamePhase`
           // However, an explicit redirect might still be useful if `fetchGameData` isn't re-triggering a render fast enough
           // or if other state changes depend on it.
           // For now, we rely on fetchGameData's state update and subsequent re-render.
           if (updatedFullGame.gamePhase !== 'lobby' && ACTIVE_PLAYING_PHASES.includes(updatedFullGame.gamePhase as GamePhaseClientState) && currentStep === 'setup' && isMountedRef.current) {
             console.log(`Client: Game phase changed to ${updatedFullGame.gamePhase} (active) via Realtime G GAMES TABLE, step is 'setup'. Auto-navigating to /game.`);
             setTimeout(() => { if (isMountedRef.current) router.push('/game'); }, 0); // Keep this for explicit nav
           }
        }
      }
    };
    
    const playersChannel = supabase
      .channel(`players-lobby-${game.gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${game.gameId}` },
        handlePlayersUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to players-lobby-${game.gameId}-${uniqueChannelSuffix} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (players-lobby-${game.gameId}-${uniqueChannelSuffix}):`, status, err);
        }
         if (err) {
            console.error(`Realtime: Subscription detailed error (players-lobby-${game.gameId}-${uniqueChannelSuffix}):`, err);
         }
      });

    const gameChannel = supabase
      .channel(`game-state-lobby-${game.gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.gameId}` },
        handleGameTableUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to game-state-lobby-${game.gameId}-${uniqueChannelSuffix} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (game-state-lobby-${game.gameId}-${uniqueChannelSuffix}):`, status, err);
        }
        if (err) {
          console.error(`Realtime: Subscription detailed error (game-state-lobby-${game.gameId}-${uniqueChannelSuffix}):`, err);
        }
      });
      
    return () => {
      if (game?.gameId) {
        console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${game.gameId}, suffix: ${uniqueChannelSuffix} on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
        supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
      }
    };
  }, [game?.gameId, fetchGameData, router, currentStep, isLoading, thisPlayerId]);

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
          // localStorage is now handled by fetchGameData after the action leads to a real-time update
          // that calls fetchGameData. We don't need to set localStorage or thisPlayerId directly here.
          // We simply rely on the real-time update to refresh the state.
          console.log(`Client: Player ${newPlayer.id} added. Real-time update should refresh state.`);
          // Let real-time update call fetchGameData.
          // await fetchGameData(`handleAddPlayer after action for game ${game.gameId}`);
        } else if (isMountedRef.current) {
          toast({ title: "Error Adding Player", description: "Could not add player. Please try again.", variant: "destructive"});
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
    setIsLoading(true); // Set loading before starting the transition/action
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
        // Redirect is handled by the server action. The `useEffect` listening to `currentStep`
        // (which changes due to redirect) will call `fetchGameData`.
        console.log("🔴 RESET (Client): resetGameForTesting server action called. Redirect should occur.");
      } catch (error: any) {
        if (isMountedRef.current) {
          // Only set isLoading to false if not a redirect error, as redirect will unmount.
          if (!(typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))) {
            setIsLoading(false);
          }
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            console.log("🔴 RESET (Client): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
            // Don't show toast here as page is navigating away
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
      // isLoading will be set to false by fetchGameData in the new page load if not a redirect error
    });
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
        // State update will come via real-time subscription calling fetchGameData
      } catch (error: any) {
        console.error("Client: Error toggling ready status:", error);
        if (isMountedRef.current) {
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };

  if (isLoading || !game ) {
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

  const thisPlayerObject = game.players && game.players.find(p => p.id === thisPlayerId);
  const gameIsConsideredActive = ACTIVE_PLAYING_PHASES.includes(game.gamePhase as GamePhaseClientState);

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
        lobbyMessage = "All players ready! Starting game...";
      }
    }

    const showPlayerSetupForm = !thisPlayerObject && game.gamePhase === 'lobby';

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
           {gameIsConsideredActive && (
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
          {!showPlayerSetupForm && thisPlayerObject && game.gamePhase === 'lobby' && (
            <p className="text-xl text-muted-foreground mt-2">
              Welcome, {thisPlayerObject.name}! Click your 'Ready' button below. Game starts when all players are ready.
            </p>
          )}
          {showPlayerSetupForm && game.gamePhase === 'lobby' && (
             <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then click your ready button!</p>
          )}
        </header>
        
        <div className={cn(
            "grid gap-8 w-full max-w-4xl",
            showPlayerSetupForm ? "md:grid-cols-2" : "grid-cols-1" 
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
          
          <Card className={cn(
              "shadow-2xl border-2 border-secondary rounded-xl overflow-hidden",
              showPlayerSetupForm ? "" : "md:col-span-2" 
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
