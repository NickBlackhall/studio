
"use client"; // Mark as a Client Component

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import type { GameClientState } from '@/lib/types';
import CurrentYear from '@/components/CurrentYear';
import { supabase } from '@/lib/supabaseClient'; 

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stepParam = searchParams?.get('step');

  const [game, setGame] = useState<GameClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingAction, startTransition] = useTransition();

  // Log Supabase config on client
  useEffect(() => {
    // @ts-ignore supabase client has .supabaseUrl and .supabaseKey
    console.log('Supabase client URL:', supabase.supabaseUrl);
    // @ts-ignore
    console.log('Supabase client Key (first 10 chars):', supabase.supabaseKey?.substring(0, 10));
  }, []);

  // Effect to fetch initial game data
  useEffect(() => {
    async function fetchGameData() {
      setIsLoading(true);
      try {
        console.log("Client: Initial fetchGameData triggered.");
        const gameState = await getGame();
        console.log("Client: Initial game state fetched:", JSON.stringify(gameState, null, 2));
        setGame(gameState);
      } catch (error) {
        console.error("Client: Failed to fetch initial game state:", error);
        setGame(null); 
      } finally {
        setIsLoading(false);
      }
    }
    fetchGameData();
  }, []); 

  // Effect for Supabase realtime subscriptions and redirection
  useEffect(() => {
    if (!game || !game.gameId || isLoading) {
      console.log("Realtime or Redirect: No game, gameId, or still loading, skipping setup.");
      return;
    }

    // Redirection logic
    if (game.gamePhase !== 'lobby' && stepParam === 'setup') {
      console.log(`Client: Game phase is ${game.gamePhase}, step is 'setup'. Preparing to redirect to /game.`);
      // Defer the navigation slightly to ensure it's outside the current render cycle
      const timer = setTimeout(() => {
        console.log(`Client: Executing redirect to /game now.`);
        router.push('/game');
      }, 0);
      return () => clearTimeout(timer); // Cleanup the timer if component unmounts or deps change
    }

    // Realtime subscription setup
    console.log(`Realtime: Setting up Supabase subscriptions for gameId: ${game.gameId}`);

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
        (payload) => {
          console.log('>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE!', payload); 
          async function fetchAndUpdate() {
            console.log('Realtime (players sub): Fetching updated game state due to player change...');
            const updatedGame = await getGame(); 
            console.log('Realtime (players sub): Updated game state from getGame():', JSON.stringify(updatedGame, null, 2));
            setGame(updatedGame);
          }
          fetchAndUpdate();
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
        (payload) => {
          console.log('>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE!', payload); 
          async function fetchAndUpdate() {
            console.log('Realtime (games sub): Fetching updated game state due to game table change...');
            const updatedGame = await getGame();
            console.log('Realtime (games sub): Updated game state from getGame():', JSON.stringify(updatedGame, null, 2));
            setGame(updatedGame);
          }
          fetchAndUpdate();
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
      if (playersChannel) {
        supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel:", err));
      }
      if (gameChannel) {
        supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel:", err));
      }
    };
  }, [game, game?.gameId, game?.gamePhase, stepParam, isLoading, router]); // Added game.gamePhase to dependencies

  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    if (name && avatar && game?.gameId) {
      startTransition(async () => {
        console.log(`Client: Attempting to add player ${name} for gameId ${game.gameId}`);
        const result = await addPlayerAction(name, avatar);
        console.log('Client: Add player action result:', JSON.stringify(result, null, 2));
        // After adding a player, immediately fetch the updated game state
        // to reflect the change on the current client's screen.
        // Realtime will handle updates for other clients.
        // This immediate fetch might be redundant if realtime is very fast, but good for snappiness on the active client.
        console.log('Client (handleAddPlayer): Fetching game state after adding player...');
        const updatedGame = await getGame();
        console.log('Client (handleAddPlayer): Game state after adding player:', JSON.stringify(updatedGame, null, 2));
        setGame(updatedGame);
      });
    } else if (!game?.gameId) {
        console.error("Client: Cannot add player: gameId is not available on client state.");
    }
  };

  const handleResetGame = async () => {
    startTransition(async () => {
      console.log("Client: Attempting to reset game.");
      await resetGameForTesting();
      // The resetGameForTesting action already redirects.
      // To ensure state consistency on this client after redirect, we might need to re-fetch.
      // However, the redirect to /?step=setup should trigger a fresh load.
      console.log("Client: Reset game action called.");
    });
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
  
  if (stepParam === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => router.push('/')} className="cursor-pointer">
            <Image
              src="https://placehold.co/300x90.png?text=Logo"
              alt="Make It Terrible Logo Placeholder"
              width={300}
              height={90}
              className="mx-auto mb-4 rounded-lg shadow-md"
              data-ai-hint="game logo"
              priority
            />
          </button>
          <h1 className="text-5xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
          <p className="text-xl text-muted-foreground mt-2">Enter your details to join the game.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground p-6">
              <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your poison (avatar).</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <PlayerSetupForm addPlayer={handleAddPlayer} />
            </CardContent>
          </Card>

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
              {game.players.length >= 2 && game.gamePhase === 'lobby' && (
                <Button
                  onClick={() => router.push('/game')} 
                  variant="default"
                  size="lg"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg font-semibold py-3 mt-6"
                  disabled={isPendingAction} 
                >
                  {isPendingAction && stepParam === 'setup' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Play className="mr-2 h-6 w-6" /> Go to Game / Start</>}
                </Button>
              )}
               {game.players.length < 2 && game.players.length > 0 && game.gamePhase === 'lobby' && (
                 <p className="text-sm text-center mt-4 text-muted-foreground">Need at least 2 players to start the game.</p>
               )}
               {game.gamePhase !== 'lobby' && ( 
                  <Button 
                    onClick={() => router.push('/game')}
                    variant="outline"
                    className="w-full text-primary border-primary hover:bg-primary/10 mt-4"
                  >
                    Game in progress ({game.gamePhase}). Go to Game <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
               )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 w-full max-w-4xl text-center">
          <form onSubmit={(e) => { e.preventDefault(); if (!isPendingAction) handleResetGame(); }}>
            <Button variant="destructive" size="sm" type="submit" className="hover:bg-destructive/80" disabled={isPendingAction}>
              {isPendingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Reset Game State (For Testing)</>}
            </Button>
          </form>
        </div>

         <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
        </footer>
      </div>
    );
  }

  // Default: Welcome/Entrance Screen (when step is not 'setup')
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground text-center">
      <Image
        src="https://placehold.co/730x218.png?text=Make+It+Terrible"
        alt="Make It Terrible Logo Placeholder"
        width={438}
        height={131}
        className="mx-auto mb-8 rounded-lg shadow-md"
        data-ai-hint="game logo large"
        priority
      />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary mb-4 sr-only">
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

    