
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
  
  const [internalGame, setInternalGame] = useState<GameClientState | null>(null);
  const gameRef = useRef<GameClientState | null>(null);

  const [internalThisPlayerId, setInternalThisPlayerId] = useState<string | null>(null);
  const thisPlayerIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  
  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';

  const setGame = useCallback((newGameState: GameClientState | null) => {
    gameRef.current = newGameState;
    if (isMountedRef.current) {
      setInternalGame(newGameState);
    }
  }, []);

  const setThisPlayerId = useCallback((newPlayerId: string | null) => {
    thisPlayerIdRef.current = newPlayerId;
    if (isMountedRef.current) {
      setInternalThisPlayerId(newPlayerId);
    }
  }, []);


  console.log("Supabase client URL:", supabase.supabaseUrl);
  console.log("Supabase client Key (first 10 chars):", supabase.supabaseKey.substring(0,10));

  const fetchGameData = useCallback(async (origin: string = "unknown") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    if (!isMountedRef.current && origin !== "initial mount") { 
        console.log(`Client: fetchGameData from ${origin} skipped as component is not mounted.`);
        return;
    }
    setIsLoading(true);

    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, gameState ? `ID: ${gameState.gameId}, Phase: ${gameState.gamePhase}, Players: ${gameState.players.length}` : "null");
      
      if (!isMountedRef.current) {
        console.log(`Client: fetchGameData from ${origin} - component unmounted after getGame() call.`);
        return;
      }

      setGame(gameState); 

      if (gameState && gameState.gameId) {
        const localStorageKey = `thisPlayerId_game_${gameState.gameId}`;
        
        if (gameState.players.length === 0) {
          console.log(`Client: Fetched game state shows 0 players for game ${gameState.gameId}. Forcefully clearing localStorage and thisPlayerId (from ${origin}).`);
          localStorage.removeItem(localStorageKey);
          setThisPlayerId(null);
        } else {
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
        const finalPlayerId = isMountedRef.current ? (localStorage.getItem(localStorageKey) || thisPlayerIdRef.current || null) : null;
        console.log(`Client: thisPlayerId ultimately set to: ${finalPlayerId} after fetch from ${origin}.`);

      } else {
        setThisPlayerId(null);
        if (gameState === null && origin !== "initial mount" && origin !== "useEffect[] mount or currentStep change to: setup") { 
            console.warn(`Client: Game state is null or no gameId from fetchGameData (origin: ${origin}). thisPlayerId set to null.`);
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
         console.log(`Client: fetchGameData from ${origin} completed. isLoading set to false.`);
      } else {
         console.log(`Client: fetchGameData from ${origin} completed, but component unmounted. isLoading NOT set to false by this call.`);
      }
    }
  }, [toast, setGame, setThisPlayerId]); 

  useEffect(() => {
    isMountedRef.current = true;
    console.log(`Client: Component mounted or currentStep changed to: ${currentStep}. Fetching game data.`);
    fetchGameData(`useEffect[] mount or currentStep change to: ${currentStep}`);
    
    return () => {
      console.log(`Client: Component unmounting or currentStep changing from: ${currentStep}. Setting isMountedRef to false.`);
      isMountedRef.current = false;
    };
  }, [fetchGameData, currentStep]);


  useEffect(() => {
    const currentGameIdFromRef = gameRef.current?.gameId; // Use ref for initial check
    const currentThisPlayerIdFromRef = thisPlayerIdRef.current;

    if (!currentGameIdFromRef || isLoading) { // Check gameId from ref
      console.log(`Realtime or Redirect: No gameId from ref, or still loading, skipping subscription setup. Game ID from ref: ${currentGameIdFromRef || 'N/A'}, isLoading: ${isLoading} on WelcomePage (currentStep: ${currentStep}), thisPlayerId from ref: ${currentThisPlayerIdFromRef}`);
      return () => {};
    }

    console.log(`Realtime: Setting up Supabase subscriptions for gameId: ${currentGameIdFromRef} on WelcomePage (currentStep: ${currentStep}), thisPlayerId: ${currentThisPlayerIdFromRef}`);
    const uniqueChannelSuffix = currentThisPlayerIdFromRef || Date.now();

    const handlePlayersUpdate = async (payload: any) => {
      console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) { 
        console.log(`Realtime (players sub for game ${latestGameId}): Fetching updated game state due to players change...`);
        await fetchGameData(`players-lobby-${latestGameId}-${uniqueChannelSuffix} player change`);
      } else {
        console.log(`Realtime (players sub): Skipping fetch, component unmounted or gameId missing. Current gameId from ref: ${latestGameId}`);
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! `, payload);
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) { 
        console.log(`Realtime (games sub for game ${latestGameId}): Fetching updated game state due to games change...`);
        const updatedFullGame = await getGame(latestGameId); 
        if (updatedFullGame && isMountedRef.current) {
           setGame(updatedFullGame); // This uses the wrapped setter, updating state and ref
           if (updatedFullGame.gamePhase !== 'lobby' && ACTIVE_PLAYING_PHASES.includes(updatedFullGame.gamePhase as GamePhaseClientState) && currentStep === 'setup') { // Removed redundant isMountedRef check
             console.log(`Client: Game phase changed to ${updatedFullGame.gamePhase} (active) via Realtime G GAMES TABLE, step is 'setup'. Auto-navigating to /game.`);
             setTimeout(() => { if (isMountedRef.current) router.push('/game'); }, 0); 
           }
        }
      } else {
         console.log(`Realtime (games sub): Skipping fetch, component unmounted or gameId missing. Current gameId from ref: ${latestGameId}`);
      }
    };
    
    const playersChannelName = `players-lobby-${currentGameIdFromRef}-${uniqueChannelSuffix}`;
    const playersChannel = supabase
      .channel(playersChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${currentGameIdFromRef}` },
        handlePlayersUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to ${playersChannelName} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (${playersChannelName}):`, status, err ? JSON.stringify(err) : 'undefined');
        }
         if (err) {
            console.error(`Realtime: Subscription detailed error (${playersChannelName}):`, err);
         }
      });

    const gameChannelName = `game-state-lobby-${currentGameIdFromRef}-${uniqueChannelSuffix}`;
    const gameChannel = supabase
      .channel(gameChannelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${currentGameIdFromRef}` },
        handleGameTableUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to ${gameChannelName} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (${gameChannelName}):`, status, err ? JSON.stringify(err) : 'undefined');
        }
        if (err) {
          console.error(`Realtime: Subscription detailed error (${gameChannelName}):`, err);
        }
      });
      
    return () => {
      const gameIdForCleanup = gameRef.current?.gameId; // Use ref for cleanup
      if (gameIdForCleanup) {
        console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${gameIdForCleanup}, suffix: ${uniqueChannelSuffix} on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
        supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
      } else {
        console.log(`Realtime: Skipping channel cleanup as game.gameId is missing from ref.`);
      }
    };
  }, [gameRef.current?.gameId, fetchGameData, router, currentStep, isLoading, thisPlayerIdRef.current, setGame]); // Rely on ref.current values for deps if they gate logic


  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    const currentGameId = gameRef.current?.gameId;

    if (!name.trim() || !avatar) {
        toast({ title: "Missing Info", description: "Please enter your name and select an avatar.", variant: "destructive" });
        return;
    }
    if (!currentGameId) {
        toast({ title: "Error!", description: "Game session not found. Please refresh.", variant: "destructive"});
        if (isMountedRef.current) await fetchGameData("handleAddPlayer_no_gameId");
        return;
    }
    
    console.log(`Client: Attempting to add player ${name} (avatar: ${avatar}) for gameId ${currentGameId}`);
    startPlayerActionTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id); 
          console.log(`Client: Player ${newPlayer.id} added. Set thisPlayerId to ${newPlayer.id} and localStorage. Now fetching game data for game ${currentGameId}.`);
          await fetchGameData(`handleAddPlayer after action for game ${currentGameId}`); 
        } else if (isMountedRef.current) {
          console.error('Client: Failed to add player or component unmounted. New player:', newPlayer, 'Game ID:', currentGameId, 'Mounted:', isMountedRef.current);
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
    setIsLoading(true); 
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
        console.log("🔴 RESET (Client): resetGameForTesting server action called. Redirect should occur.");
      } catch (error: any) {
        if (!isMountedRef.current) {
            console.warn("🔴 RESET (Client): Component unmounted during reset, skipping toast/state update.");
            return;
        }
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          console.log("🔴 RESET (Client): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
          return; 
        }
        console.error("🔴 RESET (Client): Error calling resetGameForTesting server action:", error);
        toast({
          title: "Reset Failed",
          description: `Could not reset the game. ${error.message || String(error)}`,
          variant: "destructive",
        });
        setIsLoading(false); 
      }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    const currentGameId = gameRef.current?.gameId; // Use ref
    const currentThisPlayerId = thisPlayerIdRef.current; // Use ref

    if (!currentGameId || !currentThisPlayerId) {
        toast({ title: "Error", description: "Cannot change ready status. Game or player not identified.", variant: "destructive" });
        return;
    }
    if (player.id !== currentThisPlayerId) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    console.log(`Client: Toggling ready status for player ${player.name} (ID: ${player.id}) from ${player.isReady} for game ${currentGameId}`);
    startPlayerActionTransition(async () => {
      try {
        const updatedGameState = await togglePlayerReadyStatus(player.id, currentGameId);
        if (isMountedRef.current) {
          if (updatedGameState) {
            setGame(updatedGameState); // Update local state (and ref) with the direct response
            // Check if this action caused the game to start and navigate
            if (updatedGameState.gamePhase !== 'lobby' && ACTIVE_PLAYING_PHASES.includes(updatedGameState.gamePhase as GamePhaseClientState) && currentStep === 'setup') {
              console.log(`Client: Game phase changed to ${updatedGameState.gamePhase} (active) via togglePlayerReadyStatus action for self. Auto-navigating to /game.`);
              router.push('/game');
            }
          } else {
            // Fallback to fetching if action didn't return state (it should)
            await fetchGameData(`handleToggleReady after action for game ${currentGameId}`);
          }
        }
      } catch (error: any) {
        console.error("Client: Error toggling ready status:", error);
        if (isMountedRef.current) {
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };
  
  const renderableGame = gameRef.current; // Use the ref's current value for rendering

  if (isLoading || !renderableGame ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Game...</p>
      </div>
    );
  }
  

  if (!renderableGame.gameId) {
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

  const thisPlayerObject = renderableGame.players && renderableGame.players.find(p => p.id === thisPlayerIdRef.current);
  const gameIsConsideredActive = ACTIVE_PLAYING_PHASES.includes(renderableGame.gamePhase as GamePhaseClientState);

  if (currentStep === 'setup') {
    if (!renderableGame.players) { 
      return (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading player list...</p>
        </div>
      );
    }
    
    const enoughPlayers = renderableGame.players.length >= MIN_PLAYERS_TO_START;
    const allPlayersReady = enoughPlayers && renderableGame.players.every(p => p.isReady);

    let lobbyMessage = "";
    if (renderableGame.gamePhase === 'lobby') {
      if (!enoughPlayers) {
        lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players to start. Waiting for ${MIN_PLAYERS_TO_START - renderableGame.players.length} more...`;
      } else if (!allPlayersReady) {
        const unreadyCount = renderableGame.players.filter(p => !p.isReady).length;
        lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to be ready... Game will start automatically.`;
      } else {
        // This message might briefly appear if auto-start logic is slightly delayed
        lobbyMessage = "All players ready! Starting game...";
      }
    }

    const showPlayerSetupForm = !thisPlayerObject && renderableGame.gamePhase === 'lobby';

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
                <p className="text-md">The current game is in the "{renderableGame.gamePhase}" phase.</p>
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
          {!showPlayerSetupForm && thisPlayerObject && renderableGame.gamePhase === 'lobby' && (
            <p className="text-xl text-muted-foreground mt-2">
              Welcome, {thisPlayerObject.name}! Click your 'Ready' button below. Game starts when all players are ready.
            </p>
          )}
          {showPlayerSetupForm && renderableGame.gamePhase === 'lobby' && (
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
              <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby ({renderableGame.players.length})</CardTitle>
                <CardDescription className="text-secondary-foreground/80 text-base">
                {renderableGame.gamePhase === 'lobby' ? "Game starts automatically when all players are ready." : `Current game phase: ${renderableGame.gamePhase}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {renderableGame.players.length > 0 ? (
                <ul className="space-y-3">
                  {renderableGame.players.map((player: PlayerClientState) => (
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
                      {renderableGame.gamePhase === 'lobby' && (
                        <div className="flex items-center space-x-2">
                          {player.id === thisPlayerIdRef.current ? (
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
              {renderableGame.gamePhase === 'lobby' && lobbyMessage && (
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


    
