
"use client"; // This page uses client-side hooks for realtime updates and player session

import { useEffect, useState, useTransition } from 'react';
import { redirect, useRouter } from 'next/navigation'; // useRouter from next/navigation
import { supabase } from '@/lib/supabaseClient';
import { getGame, startGame, selectCategory, submitResponse, selectWinner, nextRound, getCurrentPlayer } from '@/app/game/actions';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2 } from 'lucide-react';
import Image from 'next/image';

// Helper to get or set this client's player ID from localStorage
async function getThisClientsPlayerId(gameId: string, playersInGame: PlayerClientState[]): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  let storedPlayerId = localStorage.getItem(`thisPlayerId_game_${gameId}`);
  
  if (storedPlayerId && playersInGame.some(p => p.id === storedPlayerId)) {
    // console.log("GamePage: Found valid storedPlayerId:", storedPlayerId);
    return storedPlayerId;
  }
  
  // If no valid stored ID, and if this client might be the most recent player added (a heuristic)
  // This is imperfect. A better system might involve a session or a more robust way to claim a player identity.
  if (playersInGame.length > 0) {
    // console.log("GamePage: No valid storedPlayerId, attempting to identify based on player list.");
    // This logic is still naive for multiple tabs scenarios.
    // A more robust solution would be for addPlayer action to return the player ID, which the client then stores.
    // For now, we'll just assume if there's one player, it's this client, or if multiple, it's harder to tell without prior ID.
    // This part needs improvement for robust multi-client identification.
    // Potentially, the last player who joined *from this browser session* could be it.
    // Without that, we can't reliably pick a player.
    return null; // Or handle this case by prompting the user to select who they are if ID is lost.
  }
  
  return null;
}


export default function GamePage() {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      console.log("GamePage: Initial fetch and player identification sequence started.");
      try {
        const initialGameState = await getGame();
        setGameState(initialGameState);
        console.log("GamePage: Initial gameState fetched:", JSON.stringify(initialGameState, null, 2));

        if (initialGameState && initialGameState.gameId && initialGameState.players.length > 0) {
          const playerId = await getThisClientsPlayerId(initialGameState.gameId, initialGameState.players);
          console.log("GamePage: Determined thisPlayerId:", playerId);
          if (playerId) {
            const playerDetail = await getCurrentPlayer(playerId, initialGameState.gameId);
            setThisPlayer(playerDetail || null);
            console.log("GamePage: Fetched thisPlayer details:", JSON.stringify(playerDetail, null, 2));
          } else if (initialGameState.gamePhase !== 'lobby' && initialGameState.gamePhase !== 'winner_announcement' && initialGameState.gamePhase !== 'game_over') {
            // Only redirect if critical player ID is missing during active game phases.
            console.warn("GamePage: Could not determine current player ID. Redirecting to home.");
            // router.push('/'); // Potentially problematic if game state changes rapidly
            // return;
          }
        } else if (initialGameState && initialGameState.gamePhase === 'lobby' && initialGameState.players.length === 0) {
          console.log("GamePage: Lobby is empty, redirecting to setup.");
          router.push('/?step=setup');
          return;
        }

      } catch (error) {
        console.error("GamePage: Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
        console.log("GamePage: Initial fetch and player identification sequence ended.");
      }
    }
    fetchInitialData();
  }, [router]); // Added router to dependency array

  useEffect(() => {
    if (!gameState || !gameState.gameId || isLoading) {
      console.log("GamePage Realtime: Skipping subscription setup (no game/gameId or still loading initial data).");
      return;
    }
    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameState.gameId}`);

    const channels = [];

    // Channel for general game state changes (phase, round, judge, scenario)
    const gameChannel = supabase
      .channel(`game-updates-${gameState.gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameState.gameId}` },
        async (payload) => {
          console.log('>>> GamePage Realtime (games sub): GAMES TABLE CHANGE DETECTED!', payload.new);
          const updatedFullGame = await getGame();
          setGameState(updatedFullGame);
          // Re-fetch current player details as game state change might affect them (e.g., becoming judge)
          if (thisPlayer?.id && updatedFullGame.gameId) {
            const playerDetail = await getCurrentPlayer(thisPlayer.id, updatedFullGame.gameId);
            setThisPlayer(playerDetail || null);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to game-updates-${gameState.gameId}`);
        if (err) console.error(`GamePage Realtime: Error on game-updates-${gameState.gameId} subscription:`, err);
      });
    channels.push(gameChannel);

    // Channel for player list changes (joins, leaves, score updates, ready status)
    const playersChannel = supabase
      .channel(`players-updates-${gameState.gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameState.gameId}` },
        async (payload) => {
          console.log('>>> GamePage Realtime (players sub): PLAYERS TABLE CHANGE DETECTED!', payload);
          const updatedFullGame = await getGame();
          setGameState(updatedFullGame);
           // If this client's player data might have changed, re-fetch it
          if (thisPlayer?.id && updatedFullGame.gameId && (payload.eventType === 'UPDATE' && (payload.new as any).id === thisPlayer.id) ) {
            const playerDetail = await getCurrentPlayer(thisPlayer.id, updatedFullGame.gameId);
            setThisPlayer(playerDetail || null);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to players-updates-${gameState.gameId}`);
        if (err) console.error(`GamePage Realtime: Error on players-updates-${gameState.gameId} subscription:`, err);
      });
    channels.push(playersChannel);

    // Channel for player hand changes
    const handsChannel = supabase
      .channel(`player-hands-updates-${gameState.gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameState.gameId}` },
        async (payload: any) => {
          console.log('>>> GamePage Realtime (player_hands sub): PLAYER_HANDS TABLE CHANGE DETECTED!', payload);
          if (thisPlayer && (payload.new?.player_id === thisPlayer.id || payload.old?.player_id === thisPlayer.id)) {
            console.log(`GamePage Realtime: Hand change detected for current player ${thisPlayer.id}. Re-fetching player details.`);
            const playerDetail = await getCurrentPlayer(thisPlayer.id, gameState.gameId); // Use current gameState.gameId
            setThisPlayer(playerDetail || null);
          }
          // Also refetch full game state as player hands are part of GameClientState.players
          const updatedFullGame = await getGame();
          setGameState(updatedFullGame);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to player-hands-updates-${gameState.gameId}`);
        if (err) console.error(`GamePage Realtime: Error on player-hands-updates-${gameState.gameId} subscription:`, err);
      });
    channels.push(handsChannel);
    
    // Channel for new submissions
    const submissionsChannel = supabase
      .channel(`submissions-updates-${gameState.gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: `game_id=eq.${gameState.gameId}` },
        async (payload) => {
          console.log('>>> GamePage Realtime (responses sub): NEW SUBMISSION DETECTED!', payload);
          const updatedFullGame = await getGame(); // Refetch game state to update submissions list
          setGameState(updatedFullGame);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to submissions-updates-${gameState.gameId}`);
        if (err) console.error(`GamePage Realtime: Error on submissions-updates-${gameState.gameId} subscription:`, err);
      });
    channels.push(submissionsChannel);


    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameState?.gameId || 'N/A'}`);
      channels.forEach(channel => supabase.removeChannel(channel).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  }, [gameState?.gameId, thisPlayer?.id]); // isLoading removed, thisPlayer?.id added

  const handleStartGame = async () => {
    if (gameState?.gameId) {
      startTransition(async () => {
        console.log("GamePage: Client calling startGame server action.");
        await startGame(gameState.gameId);
        // Realtime update should refresh game state, no explicit setGameState needed here
        // However, refetching current player might be good if roles change
        const updatedGs = await getGame(); // Get fresh state to ensure this client sees immediate changes
        setGameState(updatedGs);
        if (thisPlayer?.id && updatedGs.gameId) {
          const playerDetail = await getCurrentPlayer(thisPlayer.id, updatedGs.gameId);
          setThisPlayer(playerDetail || null);
        }
      });
    }
  };
  
  const handleSelectCategory = async (category: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await selectCategory(gameState.gameId, category);
        // Realtime update takes care of game state
      });
    }
  };

  const handleSubmitResponse = async (cardText: string) => { // cardText is actually cardId from PlayerView
    if (thisPlayer && gameState && gameState.currentRound > 0 && cardText) {
      startTransition(async () => {
        await submitResponse(thisPlayer.id, cardText, gameState.gameId, gameState.currentRound);
        // Realtime update for game state, local player hand update is handled by subscription
      });
    }
  };
  
  const handleSelectWinner = async (cardText: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await selectWinner(cardText, gameState.gameId);
        // Realtime update
      });
    }
  };

  const handleNextRound = async () => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await nextRound(gameState.gameId);
        // Realtime update
      });
    }
  };


  if (isLoading) {
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
  
  if (gameState.gamePhase === 'lobby' && gameState.players.length === 0) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="https://placehold.co/150x150.png?text=Empty!" alt="Empty Lobby" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="empty lobby"/>
        <h1 className="text-4xl font-bold text-primary mb-4">Lobby is Empty!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          No players have joined the game yet. Head to the welcome page to join!
        </p>
        <Link href="/">
          <Button variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Welcome Page
          </Button>
        </Link>
      </div>
    );
  }

  if (gameState.gamePhase === 'lobby' && gameState.players.length < 2) {
    return (
         <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image src="https://placehold.co/150x150.png?text=Waiting" alt="Waiting for players" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="waiting players"/>
            <h1 className="text-4xl font-bold text-primary mb-4">Waiting for More Players...</h1>
            <p className="text-lg text-muted-foreground mb-8">
            Need at least 2 players to start. Currently {gameState.players.length} in lobby.
            </p>
            <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
             <Link href="/?step=setup" className="mt-6">
                <Button variant="outline" size="sm">
                    Back to Lobby Setup
                </Button>
            </Link>
        </div>
    );
  }
  
  if (gameState.gamePhase === 'lobby' && gameState.players.length >= 2) {
    return (
         <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image src="https://placehold.co/150x150.png?text=Ready%3F" alt="Ready to play" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="game start"/>
            <h1 className="text-4xl font-bold text-primary mb-4">Ready to Make it Terrible?</h1>
            <p className="text-lg text-muted-foreground mb-8">
            {gameState.players.length} players are in the lobby. Let the chaos begin!
            </p>
            <Button onClick={handleStartGame} disabled={isPending} variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
                {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-2 h-6 w-6" />} 
                Start Game Now!
            </Button>
            <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        </div>
    );
  }

  if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
     console.warn("GamePage: thisPlayer object is null. Game state:", JSON.stringify(gameState, null, 2));
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl text-muted-foreground">Identifying player...</p>
          <p className="text-sm mt-2">If this persists, try returning to the lobby or resetting.</p>
           <Link href="/?step=setup" className="mt-4">
            <Button variant="outline">Go to Lobby</Button>
          </Link>
        </div>
     );
  }

  const isJudge = thisPlayer?.id === gameState.currentJudgeId;

  const renderGameContent = () => {
    if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
        // This case should be caught by the loading/redirect logic above, but as a fallback:
        return <div className="text-center text-destructive">Error: Could not identify your player. Please return to lobby.</div>;
    }

    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay gameState={gameState} onNextRound={handleNextRound} />;
    }
    if (isJudge && thisPlayer) {
      return <JudgeView gameState={gameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    if (!isJudge && thisPlayer) {
      return <PlayerView gameState={gameState} player={thisPlayer} onSubmitResponse={handleSubmitResponse} />;
    }
    // Fallback for spectators or if player role can't be determined
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Spectating</CardTitle></CardHeader>
            <CardContent><p>The game is in progress. Current phase: {gameState.gamePhase}</p></CardContent>
        </Card>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 py-4 md:py-8 max-w-7xl mx-auto px-2">
      <aside className="w-full md:w-1/3 lg:w-1/4">
        <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Round {gameState.currentRound}</p>
          <Link href="/?step=setup" className="mt-2 inline-block">
            <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
              <Home className="mr-1 h-4 w-4" /> Exit to Lobby
            </Button>
          </Link>
        </div>
      </aside>
      <main className="flex-grow w-full md:w-2/3 lg:w-3/4">
        {isPending && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}
        {renderGameContent()}
      </main>
    </div>
  );
}

// Add export const dynamic for Server Components that need dynamic rendering
// This page is a client component, so force-dynamic isn't applicable here in the same way.
// However, server actions it calls are dynamic by nature.
// export const dynamic = 'force-dynamic'; // Not needed for client components like this

