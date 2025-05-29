
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame } from '@/app/game/actions';
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

  const [game, setGame] = useState<GameClientState | null>(null);
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, startTransition] = useTransition();
  const { toast } = useToast();
  const hasAutoNavigatedToGame = useRef(false);
  const currentStep = searchParams?.get('step') || 'welcome';

  const fetchGameData = useCallback(async (origin: string = "unknown") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    setIsLoading(true);
    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, gameState ? `ID: ${gameState.gameId}, Phase: ${gameState.gamePhase}, Players: ${gameState.players.length}` : "null");
      setGame(gameState);

      if (gameState?.gameId) {
        const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${gameState.gameId}`);
        console.log(`Supabase client URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
        console.log(`Supabase client Key (first 10 chars): ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0,10)}`);
        if (playerIdFromStorage) {
          const playerInGame = gameState.players.find(p => p.id === playerIdFromStorage);
          if (playerInGame) {
            setThisPlayerId(playerIdFromStorage);
            console.log(`Client: Player ${playerIdFromStorage} identified from storage and found in game.`);
          } else {
            console.warn(`Client: Player ${playerIdFromStorage} from storage NOT found in game. Clearing stale ID for game ${gameState.gameId}.`);
            localStorage.removeItem(`thisPlayerId_game_${gameState.gameId}`);
            setThisPlayerId(null);
          }
        } else {
          setThisPlayerId(null);
          console.log(`Client: No player ID in storage for game ${gameState.gameId}.`);
        }
      } else {
        setThisPlayerId(null); 
      }
    } catch (error: any) {
      console.error(`Client: Failed to fetch initial game state (from ${origin}):`, error);
      toast({ title: "Load Error", description: `Could not load game: ${error.message || String(error)}`, variant: "destructive"});
      setGame(null); 
      setThisPlayerId(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchGameData(`useEffect[] mount: currentStep=${currentStep}`);
  }, [fetchGameData, currentStep]);


  useEffect(() => {
    if (!game || !game.gameId || isLoading) {
      console.log(`Realtime or Redirect: No game, gameId, or still loading, skipping setup for gameId: ${game?.gameId || 'N/A'} on WelcomePage (currentStep: ${currentStep})`);
      return;
    }

    console.log(`Realtime: Setting up Supabase subscriptions on WelcomePage for gameId: ${game.gameId}`);
    
    const handleGameUpdate = async (originTable: string, payload: any) => {
      console.log(`>>> Realtime: ${originTable.toUpperCase()} TABLE CHANGE DETECTED! (Lobby page for game ${game.gameId}) Payload:`, payload);
      console.log(`Realtime (${originTable} sub for game ${game.gameId}): Fetching updated game state...`);
      const updatedGame = await getGame(game.gameId); 
      if (updatedGame) {
        console.log(`Realtime (${originTable} sub for game ${game.gameId}): Updated game state from getGame():`, updatedGame);
        setGame(updatedGame);

        const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${updatedGame.gameId}`);
        if (playerIdFromStorage && !updatedGame.players.some(p => p.id === playerIdFromStorage)) {
          console.warn(`Realtime: Current player ${playerIdFromStorage} no longer in updated player list. Clearing local ID.`);
          localStorage.removeItem(`thisPlayerId_game_${updatedGame.gameId}`);
          setThisPlayerId(null);
        } else if (playerIdFromStorage && updatedGame.players.some(p => p.id === playerIdFromStorage)) {
          setThisPlayerId(playerIdFromStorage);
        }
        
        // Auto-navigation for players in lobby when game starts (phase changes from lobby)
        if (currentStep === 'setup' &&
            game.gamePhase === 'lobby' && // Game *was* in lobby
            ACTIVE_PLAYING_PHASES.includes(updatedGame.gamePhase as GamePhaseClientState) && // Game *is now* active
            !hasAutoNavigatedToGame.current) {
          console.log(`Client: Game phase changed from lobby to ${updatedGame.gamePhase} (active), step is 'setup'. Auto-navigating to /game.`);
          hasAutoNavigatedToGame.current = true; 
          router.push('/game');
        } else if (updatedGame.gamePhase === 'lobby') {
          hasAutoNavigatedToGame.current = false; // Reset if game returns to lobby
        }

      } else {
        console.error(`Realtime (${originTable} sub for game ${game.gameId}): Failed to fetch updated game state after ${originTable} table change. Current game state might be stale.`);
      }
    };
    
    const uniqueChannelSuffix = thisPlayerId || Date.now();

    const playersChannel = supabase
      .channel(`players-lobby-${game.gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${game.gameId}` },
        (payload: any) => {
          console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! `, payload);
          console.log(`Realtime (players sub for game ${game.gameId}): Fetching updated game state due to players change...`);
          fetchGameData(`players-sub-${payload.eventType}`);
        }
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to players-lobby-${game.gameId}-${uniqueChannelSuffix} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (players-lobby-${game.gameId}):`, status, err);
        }
         if (err) {
            console.error(`Realtime: Subscription detailed error (players-lobby-${game.gameId}):`, err);
         }
      });

    const gameChannel = supabase
      .channel(`game-state-lobby-${game.gameId}-${uniqueChannelSuffix}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.gameId}` },
        (payload: any) => {
           console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! `, payload);
           console.log(`Realtime (games sub for game ${game.gameId}): Fetching updated game state due to games change...`);
           fetchGameData(`games-sub-${payload.eventType}`);
        }
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') console.log(`Realtime: Successfully subscribed to game-state-lobby-${game.gameId}-${uniqueChannelSuffix} on WelcomePage!`);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (game-state-lobby-${game.gameId}):`, status, err);
        }
        if (err) {
          console.error(`Realtime: Subscription detailed error (game-state-lobby-${game.gameId}):`, err);
        }
      });

    return () => {
      console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${game.gameId} (channel suffix ${uniqueChannelSuffix}) on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
      supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
      supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
    };
  }, [game, fetchGameData, router, currentStep, isLoading]);


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
        await fetchGameData("handleAddPlayer_no_gameId");
        return;
    }

    console.log(`Client: Attempting to add player ${name} (avatar: ${avatar}) for gameId ${game.gameId}`);
    startTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && game?.gameId) { 
          const localStorageKey = `thisPlayerId_game_${game.gameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          console.log(`Client: Player ID ${newPlayer.id} stored in localStorage with key ${localStorageKey}`);
          
          // Fetch game state again to update this client immediately
          // Realtime will update other clients
          console.log("Client (handleAddPlayer): Fetching game state after adding player...");
          await fetchGameData("handleAddPlayer_success");
        } else {
          console.error("Client: Failed to add player or set player ID in localStorage.", { newPlayer, gameId: game?.gameId });
          toast({ title: "Error Adding Player", description: "Could not add player or save session. Please try again.", variant: "destructive"});
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
    startTransition(async () => {
        try {
            await resetGameForTesting();
            // Redirect is handled by the server action
            // On redirect, fetchGameData will run via useEffect and get the fresh lobby state
        } catch (error: any) {
            if (error && typeof (error as any).digest === 'string' && (error as any).digest.startsWith('NEXT_REDIRECT')) {
                console.log("🔴 RESET (Client): Caught NEXT_REDIRECT. Allowing Next.js to handle navigation.");
                // Let Next.js handle the redirect, no further client-side action needed here for the redirect itself
            } else {
                console.error("🔴 RESET (Client): Error calling resetGameForTesting server action:", error);
                toast({
                    title: "Reset Failed",
                    description: `Could not reset the game. ${error.message || String(error)}`,
                    variant: "destructive",
                });
            }
        }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    if (!game || !game.gameId || !thisPlayerId) {
        console.warn("Client: Cannot toggle ready. No gameId or thisPlayerId is not set.", { game, player, thisPlayerId });
        toast({ title: "Error", description: "Cannot change ready status. Game or player not identified.", variant: "destructive" });
        return;
    }
    if (player.id !== thisPlayerId) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    console.log(`Client: Toggling ready status for player ${player.name} (ID: ${player.id}) from ${player.isReady} for game ${game.gameId}`);
    startTransition(async () => {
      try {
        // The togglePlayerReadyStatus action will call startGame if conditions are met
        await togglePlayerReadyStatus(player.id, game.gameId);
        // Re-fetch is handled by realtime subscription
      } catch (error: any) {
        console.error("Client: Error toggling ready status:", error);
        toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
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
        <Image src="/logo.png" alt="Make It Terrible Logo" width={365} height={109} className="mx-auto" data-ai-hint="game logo large" priority />
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const gameIsActive = ACTIVE_PLAYING_PHASES.includes(game.gamePhase as GamePhaseClientState);
  const thisPlayerObject = game.players.find(p => p.id === thisPlayerId);


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
        lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to be ready... Game will start automatically when all are ready.`;
      } else {
        lobbyMessage = "All players ready! Starting game momentarily...";
      }
    }

    const showPlayerSetupForm = !gameIsActive && game.gamePhase === 'lobby' && !thisPlayerId;
    const playerHasJoinedAndInLobby = thisPlayerId && game.gamePhase === 'lobby' && thisPlayerObject;

    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => router.push('/')} className="cursor-pointer">
            <Image
              src="/logo.png"
              alt="Make It Terrible Logo"
              width={365}
              height={109}
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
           {playerHasJoinedAndInLobby && (
            <p className="text-xl text-muted-foreground mt-2">
              Welcome, {thisPlayerObject?.name}! Click your 'Ready' button below.
            </p>
          )}
        </header>

        <div className={cn(
            "grid gap-8 w-full max-w-4xl",
            // If form is hidden and player is in lobby, player list takes full width.
            // Otherwise, if form is shown OR game is active (cant join msg), it's two columns.
            playerHasJoinedAndInLobby ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
        )}>
          {/* Left Panel: Either PlayerSetupForm or null (if player has joined) or Game Active message */}
          {showPlayerSetupForm ? (
            <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your avatar.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <PlayerSetupForm addPlayer={handleAddPlayer} />
              </CardContent>
            </Card>
          ) : gameIsActive && !thisPlayerId ? ( // Game is active, and this user is NOT a player yet
            <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 md:col-span-2">
               <p className="text-center text-lg text-foreground mb-4">A game is already in progress.</p>
               <p className="text-center text-sm text-muted-foreground mb-4">You can join the next game once this one finishes.</p>
            </Card>
          ) : null /* If playerHasJoinedAndInLobby, this left panel is hidden */ }


          {/* Right Panel: Player List - Only shown if not (gameIsActive && !thisPlayerId) */}
          {!(gameIsActive && !thisPlayerId) && (
             <Card className={cn(
                "shadow-2xl border-2 border-secondary rounded-xl overflow-hidden",
                playerHasJoinedAndInLobby ? "md:col-span-1" : "" // If it's single column overall, it's effectively col-span-1
             )}>
              <CardHeader className="bg-secondary text-secondary-foreground p-6">
                <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby ({game.players.length})</CardTitle>
                 <CardDescription className="text-secondary-foreground/80 text-base">
                  {game.gamePhase === 'lobby' ? "Game starts automatically when all are ready." : "Current players in game."}
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
                                {isProcessingAction && player.id === thisPlayerId ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (player.isReady ? <ThumbsUp className="mr-1 h-3 w-3"/> : <ThumbsDown className="mr-1 h-3 w-3"/>)}
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
