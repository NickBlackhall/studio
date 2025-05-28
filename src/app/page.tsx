
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

import { useSearchParams, useRouter } from 'next/navigation'; // Import useRouter
import { useState, useEffect, useTransition } from 'react';

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const router = useRouter(); // Get router instance
  const step = searchParams?.get('step');

  const [game, setGame] = useState<GameClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingAction, startTransition] = useTransition();

  // Effect to fetch initial game data
  useEffect(() => {
    async function fetchGameData() {
      setIsLoading(true);
      try {
        const gameState = await getGame();
        setGame(gameState);
      } catch (error) {
        console.error("Failed to fetch game state:", error);
        setGame(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGameData();
  }, []);

  // Effect for Supabase realtime subscriptions
  useEffect(() => {
    if (!game || !game.gameId) {
      console.log("Realtime: No game or gameId, skipping subscription setup.");
      return;
    }

    console.log(`Setting up Supabase realtime subscription for gameId: ${game.gameId}`);

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
          console.log('Realtime: Player change received!', payload);
          async function fetchAndUpdate() {
            const updatedGame = await getGame();
            setGame(updatedGame);
          }
          fetchAndUpdate();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to players-lobby-${game.gameId}!`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error (players):', status, err);
        }
         if (err) {
            console.error('Realtime subscription detailed error (players):', err);
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
          console.log('Realtime: Game state change received!', payload);
          async function fetchAndUpdate() {
            const updatedGame = await getGame();
            setGame(updatedGame);
          }
          fetchAndUpdate();
        }
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to game-state-${game.gameId}!`);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error (game state):', status, err);
        }
        if (err) {
            console.error('Realtime subscription detailed error (game state):', err);
        }
      });

    return () => {
      console.log(`Cleaning up Supabase realtime subscriptions for gameId: ${game.gameId}`);
      supabase.removeChannel(playersChannel).catch(err => console.error("Error removing players channel:", err));
      supabase.removeChannel(gameChannel).catch(err => console.error("Error removing game channel:", err));
    };
  }, [game?.gameId]);

  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    if (name && avatar && game?.gameId) { // Ensure gameId is present
      startTransition(async () => {
        await addPlayerAction(name, avatar);
        // Realtime should handle the update, but direct fetch can be a fallback
        // const updatedGame = await getGame();
        // setGame(updatedGame);
      });
    } else if (!game?.gameId) {
        console.error("Cannot add player: gameId is not available.");
    }
  };

  const handleResetGame = async () => {
    startTransition(async () => {
      await resetGameForTesting();
      // The resetGameForTesting action already redirects.
      // To ensure state consistency on this client after redirect, we might need to re-fetch.
      // However, the redirect to /?step=setup should trigger a fresh load.
      const freshGame = await getGame(); // Fetch fresh state after reset
      setGame(freshGame);
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
      </div>
    );
  }

  if (game.gamePhase !== 'lobby' && step === 'setup' && !isLoading) {
     // If game has started and user is on setup page, redirect them to the game page.
     // This might happen if they bookmark /?step=setup or use back button.
     // Ensure a player exists for this client session to avoid redirecting spectators who landed on setup.
     // This logic might need refinement based on how currentPlayerId is managed across sessions.
     console.log(`Game phase is ${game.gamePhase}, attempting to redirect to /game from setup.`);
     router.push('/game');
     return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Redirecting to game...</p>
        </div>
     );
  }


  if (step === 'setup') {
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
              <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby</CardTitle>
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
                  {isPendingAction ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Play className="mr-2 h-6 w-6" /> Start Game</>}
                </Button>
              )}
               {game.players.length < 2 && game.players.length > 0 && game.gamePhase === 'lobby' && (
                 <p className="text-sm text-center mt-4 text-muted-foreground">Need at least 2 players to start the game.</p>
               )}
               {game.gamePhase !== 'lobby' && (
                  <p className="text-sm text-center mt-4 text-accent-foreground bg-accent p-2 rounded-md">Game in progress! State: {game.gamePhase}</p>
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

  // Default: Welcome/Entrance Screen
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
    

    