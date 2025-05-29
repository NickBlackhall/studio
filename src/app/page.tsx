
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, startGame } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import type { GameClientState, GamePhaseClientState } from '@/lib/types';
import CurrentYear from '@/components/CurrentYear';
import { supabase } from '@/lib/supabaseClient';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { useToast } from "@/hooks/use-toast";

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [game, setGame] = useState<GameClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingAction, startTransition] = useTransition();
  const { toast } = useToast();

  const [step, setStep] = useState<'welcome' | 'setup'>('welcome');

  useEffect(() => {
    // @ts-ignore supabase client has .supabaseUrl and .supabaseKey
    console.log('Supabase client URL:', supabase.supabaseUrl);
    // @ts-ignore
    console.log('Supabase client Key (first 10 chars):', supabase.supabaseKey?.substring(0, 10));
  }, []);

  useEffect(() => {
    const stepParam = searchParams?.get('step');
    if (stepParam === 'setup') {
      setStep('setup');
    } else {
      setStep('welcome');
    }
  }, [searchParams]);

  const fetchGameData = useCallback(async (origin: string = "initial") => {
    console.log(`Client: Initial fetchGameData triggered from ${origin}.`);
    setIsLoading(true);
    try {
      const gameState = await getGame();
      console.log(`Client: Initial game state fetched (from ${origin}):`, JSON.stringify(gameState, null, 2));
      setGame(gameState);
    } catch (error: any) {
      console.error(`Client: Failed to fetch initial game state (from ${origin}):`, error);
      toast({ title: "Load Error", description: `Could not load game: ${error.message || String(error)}`, variant: "destructive"});
      setGame(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGameData("useEffect[] mount");
  }, [fetchGameData]);

  useEffect(() => {
    if (!game || !game.gameId || isLoading) {
      console.log("Realtime or Redirect: No game, gameId, or still loading, skipping setup.");
      return;
    }
    const gameId = game.gameId;
    console.log(`Realtime: Setting up Supabase subscriptions for gameId: ${gameId}`);

    const commonPayloadHandler = async (sourceTable: string, payload: any) => {
      console.log(`>>> Realtime: ${sourceTable.toUpperCase()} TABLE CHANGE DETECTED BY SUPABASE! Payload:`, payload.new ? payload.new : payload.old ? payload.old : payload);
      console.log(`Realtime (${sourceTable} sub for game ${gameId}): Fetching updated game state due to ${sourceTable} change...`);
      try {
        const updatedGame = await getGame(gameId);
        console.log(`Realtime (${sourceTable} sub for game ${gameId}): Updated game state from getGame():`, JSON.stringify(updatedGame, null, 2));
        setGame(updatedGame);
      } catch (error) {
        console.error(`Realtime (${sourceTable} sub for game ${gameId}): Error fetching game state after ${sourceTable} update:`, error);
      }
    };

    const playersChannel = supabase
      .channel(`players-lobby-${game.gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${game.gameId}`,
        },
        (payload: any) => {
          console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE!`, payload);
          console.log(`Realtime (players sub for game ${game.gameId}): Fetching updated game state due to players change...`);
          getGame(game.gameId).then(updatedGame => {
            console.log(`Realtime (players sub for game ${game.gameId}): Updated game state from getGame():`, JSON.stringify(updatedGame, null, 2));
            setGame(updatedGame);
          }).catch(error => {
             console.error(`Realtime (players sub for game ${game.gameId}): Error fetching game state after players update:`, error);
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime: Successfully subscribed to players-lobby-${game.gameId}!`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (players-lobby-${game.gameId}):`, status, err);
        }
         if (err) {
            console.error(`Realtime: Subscription detailed error (players-lobby-${game.gameId}):`, err);
        }
      });

    const gameChannel = supabase
      .channel(`game-state-${game.gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.gameId}`,
        },
        (payload: any) => {
          console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE!`, payload);
          console.log(`Realtime (games sub for game ${game.gameId}): Fetching updated game state due to games change...`);
          getGame(game.gameId).then(updatedGame => {
             console.log(`Realtime (games sub for game ${game.gameId}): Updated game state from getGame():`, JSON.stringify(updatedGame, null, 2));
            setGame(updatedGame);
          }).catch(error => {
            console.error(`Realtime (games sub for game ${game.gameId}): Error fetching game state after games update:`, error);
          });
        }
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') {
          console.log(`Realtime: Successfully subscribed to game-state-${game.gameId}!`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (game-state-${game.gameId}):`, status, err);
        }
        if (err) {
            console.error(`Realtime: Subscription detailed error (game-state-${game.gameId}):`, err);
        }
      });

    return () => {
      console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${game?.gameId || 'N/A'}`);
      if (playersChannel) supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel:", err));
      if (gameChannel) supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel:", err));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.gameId]); // Removed isLoading from dependencies as it caused re-subscriptions

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
    console.log(`Client: Attempting to add player ${name} for gameId ${currentLocalGameId}`);
    startTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && currentLocalGameId) {
          const localStorageKey = `thisPlayerId_game_${currentLocalGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          console.log(`Client: Player ID ${newPlayer.id} stored in localStorage with key ${localStorageKey}`);

          console.log("Client (handleAddPlayer): Fetching game state after adding player...");
          const updatedGame = await getGame(currentLocalGameId);
          console.log("Client (handleAddPlayer): Game state after adding player:", JSON.stringify(updatedGame, null, 2));
          setGame(updatedGame);
          // Toast for player joining can be excessive with real-time updates
          // toast({ title: "Welcome!", description: `${name} has joined the game!`});
        } else {
          console.error("Client: Failed to add player or set player ID in localStorage.", { newPlayer, gameId: currentLocalGameId });
          toast({ title: "Error!", description: "Could not add player or save session. Please try again.", variant: "destructive"});
        }
      } catch (error: any) {
          console.error("Client: Error calling addPlayerAction:", error);
          toast({ title: "Error Adding Player", description: error.message || String(error), variant: "destructive"});
      }
    });
  };

  const handleResetGame = async () => {
    console.log("🔴 RESET (Client): Button clicked - calling resetGameForTesting server action.");
    startTransition(async () => {
      try {
        await resetGameForTesting();
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
    });
  };

  const handleStartGameFromLobby = async () => {
    if (game?.gameId && game.players.length >= 2 && game.gamePhase === 'lobby') {
      console.log(`Client: User clicked 'Start Game & Go to Arena' for game ${game.gameId}. Calling startGame server action.`);
      startTransition(async () => {
        try {
          const updatedGameState = await startGame(game.gameId);
          if (updatedGameState) {
            // Server action revalidates and client real-time should pick up the phase change.
            // Navigation to /game will happen due to phase change if on setup, or directly if preferred.
            router.push('/game');
            toast({ title: "Game Starting!", description: "Let the terrible choices begin!" });
          } else {
            throw new Error("Start game action did not return updated game state.");
          }
        } catch (error: any) {
            console.error("Client: Error starting game from lobby:", error);
            toast({ title: "Cannot Start Game", description: `Failed to start: ${error.message || String(error)}`, variant: "destructive"});
        }
      });
    } else {
      console.warn("Client: Cannot start game from lobby. Conditions not met.", game);
      toast({ title: "Cannot Start Game", description: "Not enough players or game not in lobby phase.", variant: "destructive"});
    }
  };


  if (isLoading) {
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
        <p className="text-xl text-destructive">Could not load game data. Please try refreshing.</p>
        <p className="text-sm text-muted-foreground mt-2">Check browser console and server logs for errors.</p>
         <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const activePlayingPhases: GamePhaseClientState[] = ['category_selection', 'player_submission', 'judging'];
  const isGameActiveAndNotLobby = activePlayingPhases.includes(game.gamePhase as GamePhaseClientState);

  if (step === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => router.push('/')} className="cursor-pointer">
            <Image
              src="/logo.png"
              alt="Make It Terrible Logo"
              width={300}
              height={90}
              className="mx-auto mb-4 rounded-lg shadow-md"
              data-ai-hint="game logo"
              priority
            />
          </button>
          <h1 className="text-5xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1> {/* Hidden if logo is present */}
          {isGameActiveAndNotLobby &&
            <div className="my-4 p-4 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
                <p className="font-bold">Game in Progress!</p>
                <p>The current game is in the "{game.gamePhase}" phase.</p>
                 <Button
                    onClick={() => router.push('/game')}
                    variant="link"
                    className="text-yellow-700 dark:text-yellow-300 hover:underline p-0 h-auto mt-1"
                >
                    Go to Game <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
            </div>
          }
          {!isGameActiveAndNotLobby && game.gamePhase === 'lobby' &&
            <p className="text-xl text-muted-foreground mt-2">Enter your details to join the game.</p>
          }
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {(!isGameActiveAndNotLobby || game.gamePhase === 'lobby') && (
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
          {isGameActiveAndNotLobby && ! (game.gamePhase === 'lobby') && (
             <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden flex flex-col items-center justify-center p-6 md:col-span-2">
                <p className="text-center text-lg text-foreground mb-4">A game is already in progress. You can join the lobby and wait for the next game, or reset if you're testing.</p>
                <PlayerSetupForm addPlayer={handleAddPlayer} /> {/* Still allow joining lobby */}
             </Card>
          )}

          <Card className="shadow-2xl border-2 border-secondary rounded-xl overflow-hidden">
            <CardHeader className="bg-secondary text-secondary-foreground p-6">
              <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby ({game.players.length})</CardTitle>
              <CardDescription className="text-secondary-foreground/80 text-base">See who's brave enough to play.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {game.players.length > 0 ? (
                <ul className="space-y-3">
                  {game.players.map((player) => (
                    <li key={player.id} className="flex items-center p-3 bg-muted rounded-lg shadow">
                      <span className="text-4xl mr-4">{player.avatar}</span>
                      <span className="text-xl font-medium text-foreground">{player.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-center py-4">No players yet. Be the first to cause some trouble!</p>
              )}
              {(game.players.length >= 2 && game.gamePhase === 'lobby') && (
                <Button
                  onClick={handleStartGameFromLobby}
                  variant="default"
                  size="lg"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg font-semibold py-3 mt-6"
                  disabled={isPendingAction}
                >
                  {isPendingAction ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Play className="mr-2 h-6 w-6" /> Start Game & Go to Arena</>}
                </Button>
              )}
              {game.players.length < 2 && game.gamePhase === 'lobby' && (
                <p className="text-sm text-center mt-4 text-muted-foreground">Need at least 2 players to start the game.</p>
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
            {isPendingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Reset Game State (For Testing)</>}
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
        width={438}
        height={131}
        className="mx-auto mb-8 rounded-lg shadow-md"
        data-ai-hint="game logo large"
        priority
      />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary mb-4 sr-only"> {/* Hidden if logo is present */}
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
