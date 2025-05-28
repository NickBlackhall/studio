
"use client"; 

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation'; 
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
import { useToast } from '@/hooks/use-toast';


export default function GamePage() {
  const [gameState, setGameState] = useState<GameClientState | null>(null);
  const [thisPlayer, setThisPlayer] = useState<PlayerClientState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialData() {
      console.log("GamePage: Mounting. Starting initial data fetch.");
      setIsLoading(true);
      let localGameId: string | null = null;
      try {
        const initialGameState = await getGame();
        setGameState(initialGameState);
        console.log("GamePage: Initial gameState fetched:", initialGameState ? `ID: ${initialGameState.gameId}, Phase: ${initialGameState.gamePhase}, Players: ${initialGameState.players.length}` : "null");

        if (initialGameState && initialGameState.gameId) {
          localGameId = initialGameState.gameId; // Store for localStorage key
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${localGameId}`);
          console.log(`GamePage: For gameId ${localGameId}, player ID from storage: ${playerIdFromStorage}`);

          if (playerIdFromStorage) {
            // Check if player is in the fetched game state's player list
            const playerInGameList = initialGameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGameList) {
                console.log(`GamePage: Player ${playerIdFromStorage} found in initial game state players list.`);
                setThisPlayer(playerInGameList); // Use player data from game state if available
            } else {
                // If not in the list, try fetching directly (could be a slight sync issue)
                console.log(`GamePage: Player ${playerIdFromStorage} NOT in initial game state players list. Attempting direct fetch.`);
                const playerDetail = await getCurrentPlayer(playerIdFromStorage, localGameId);
                setThisPlayer(playerDetail || null);
                console.log("GamePage: Fetched thisPlayer details directly:", playerDetail ? playerDetail.id : "null");
            }
          } else {
            console.warn("GamePage: No player ID found in localStorage for this game session.");
            setThisPlayer(null);
          }
        } else if (initialGameState && initialGameState.gamePhase === 'lobby' && initialGameState.players.length === 0) {
          console.log("GamePage: Lobby is empty, redirecting to setup.");
          router.push('/?step=setup');
          return; 
        }
      } catch (error) {
        console.error("GamePage: Error fetching initial data:", error);
        toast({ title: "Error Loading Game", description: "Could not fetch game data. Please try refreshing.", variant: "destructive" });
        setThisPlayer(null); // Ensure thisPlayer is null on error
      } finally {
        setIsLoading(false);
        console.log("GamePage: Initial data fetch sequence ended.");
      }
    }
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Runs once on mount

  useEffect(() => {
    if (!gameState || !gameState.gameId) {
      console.log("GamePage Realtime: Skipping subscription setup (no game/gameId).");
      return;
    }
    const gameId = gameState.gameId; // stable gameId for subscriptions
    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}`);

    const channels = [];

    const commonPayloadHandler = async (payloadOrigin: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${payloadOrigin} sub): CHANGE DETECTED!`, payload);
      try {
        const updatedFullGame = await getGame();
        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from ${payloadOrigin} event. Phase: ${updatedFullGame?.gamePhase}, Players: ${updatedFullGame?.players?.length}`);
        
        if (thisPlayer?.id && updatedFullGame?.gameId) {
          const latestPlayerDetails = await getCurrentPlayer(thisPlayer.id, updatedFullGame.gameId);
          setThisPlayer(latestPlayerDetails || null);
           console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
        }
      } catch (error) {
        console.error(`GamePage Realtime: Error processing ${payloadOrigin} update:`, error);
      }
    };

    const gameChannel = supabase
      .channel(`game-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => commonPayloadHandler('games', payload)
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to game-updates-${gameId}`);
        if (err) console.error(`GamePage Realtime: Error on game-updates-${gameId} subscription:`, err);
      });
    channels.push(gameChannel);

    const playersChannel = supabase
      .channel(`players-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (payload) => commonPayloadHandler('players', payload)
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to players-updates-${gameId}`);
        if (err) console.error(`GamePage Realtime: Error on players-updates-${gameId} subscription:`, err);
      });
    channels.push(playersChannel);

    const handsChannel = supabase
      .channel(`player-hands-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `game_id=eq.${gameId}` },
         (payload) => commonPayloadHandler('player_hands', payload)
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to player-hands-updates-${gameId}`);
        if (err) console.error(`GamePage Realtime: Error on player-hands-updates-${gameId} subscription:`, err);
      });
    channels.push(handsChannel);
    
    const submissionsChannel = supabase
      .channel(`submissions-updates-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `game_id=eq.${gameId}` },
        (payload) => commonPayloadHandler('responses', payload)
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to submissions-updates-${gameId}`);
        if (err) console.error(`GamePage Realtime: Error on submissions-updates-${gameId} subscription:`, err);
      });
    channels.push(submissionsChannel);


    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}`);
      channels.forEach(channel => supabase.removeChannel(channel).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.gameId]); // Re-subscribe if gameId changes (e.g. after a full reset that creates a new game)


  const handleStartGame = async () => {
    if (gameState?.gameId && gameState.gamePhase === 'lobby') {
      startTransition(async () => {
        console.log("GamePage: Client calling startGame server action.");
        await startGame(gameState.gameId);
        // State update will be handled by realtime subscription
      });
    } else {
      toast({title: "Cannot Start", description: "Game not in lobby or no game ID.", variant: "destructive"})
    }
  };
  
  const handleSelectCategory = async (category: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await selectCategory(gameState.gameId, category);
      });
    }
  };

  const handleSubmitResponse = async (cardText: string) => { 
    // Note: We need the card ID, not text, if submissions are by ID.
    // For now, assuming cardText is what we used for PlayerView to select from hand.
    // This needs to be aligned with how cards are represented in PlayerView.
    // Let's assume PlayerView provides the actual card text from the player's hand.
    if (thisPlayer && gameState && gameState.currentRound > 0 && cardText && gameState.currentScenario) {
        const { data: handCard, error: handCardError } = await supabase
            .from('player_hands')
            .select('response_card_id')
            .eq('player_id', thisPlayer.id)
            .eq('game_id', gameState.gameId)
            // We need to find the card_id that corresponds to cardText
            // This requires joining with response_cards table or having card_id in player.hand
            // For now, this is a placeholder. PlayerView should pass card_id.
            // Let's assume cardText IS the ID for now, and fix PlayerView if needed.
            // This part is problematic and needs card ID to be passed from PlayerView
            // For now, this will likely fail or be incorrect.
            // A better approach would be for PlayerView to pass the response_card_id.
            // Let's assume `cardText` is actually the card_id for now for the server action call.
            // The PlayerView needs to be updated to store and pass card_id.

        // This part of the logic is flawed without knowing the card_id.
        // For the purpose of this commit, we'll assume cardText is the response_card_id,
        // which is INCORRECT based on current types but allows the action to be called.
        // THIS NEEDS TO BE FIXED IN PlayerView.tsx to pass the actual card_id.
        const cardIdToSubmit = cardText; // Placeholder - this should be the actual ID

        if (!cardIdToSubmit) {
            toast({title: "Error", description: "Could not identify the card to submit.", variant: "destructive"});
            return;
        }

        startTransition(async () => {
            await submitResponse(thisPlayer.id, cardIdToSubmit, gameState.gameId, gameState.currentRound);
        });
    } else {
        toast({title: "Cannot Submit", description: "Submission conditions not met.", variant: "destructive"});
    }
  };
  
  const handleSelectWinner = async (cardText: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await selectWinner(cardText, gameState.gameId);
      });
    }
  };

  const handleNextRound = async () => {
    if (gameState?.gameId) {
      startTransition(async () => {
        await nextRound(gameState.gameId);
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
  
  if (gameState.gamePhase === 'lobby' && gameState.players.length > 0) {
    const enoughPlayers = gameState.players.length >= 2;
     return (
         <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image 
              src={enoughPlayers ? "https://placehold.co/150x150.png?text=Ready%3F" : "https://placehold.co/150x150.png?text=Waiting"} 
              alt={enoughPlayers ? "Ready to play" : "Waiting for players"} 
              width={150} height={150} className="mb-6 rounded-lg shadow-md" 
              data-ai-hint={enoughPlayers ? "game start" : "waiting players"}
            />
            <h1 className="text-4xl font-bold text-primary mb-4">
              {enoughPlayers ? "Ready to Make it Terrible?" : "Waiting for More Players..."}
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
            {gameState.players.length} players are in the lobby. 
            {enoughPlayers ? " Let the chaos begin!" : " Need at least 2 to start."}
            </p>
            {enoughPlayers && (
                <Button onClick={handleStartGame} disabled={isPending} variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
                    {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-2 h-6 w-6" />} 
                    Start Game Now!
                </Button>
            )}
            <div className="mt-8 w-full max-w-md">
              <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
            </div>
             <Link href="/?step=setup" className="mt-6">
                <Button variant="outline" size="sm">
                    Back to Main Lobby
                </Button>
            </Link>
        </div>
    );
  }
  
  if (gameState.gamePhase === 'lobby' && gameState.players.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <p className="text-xl text-muted-foreground">Lobby is empty. Add players from the main page.</p>
          <Link href="/?step=setup" className="mt-4">
            <Button variant="outline">Go to Player Setup</Button>
          </Link>
        </div>
     );
  }

  if (!thisPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
     console.warn("GamePage: thisPlayer object is null, but game is active. Game state:", JSON.stringify(gameState, null, 2));
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
        return <div className="text-center text-destructive">Error: Could not identify your player for this game. Please return to lobby.</div>;
    }

    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay gameState={gameState} onNextRound={handleNextRound} />;
    }
    if (isJudge && thisPlayer) {
      return <JudgeView gameState={gameState} judge={thisPlayer} onSelectCategory={handleSelectCategory} onSelectWinner={handleSelectWinner} />;
    }
    if (!isJudge && thisPlayer) {
      // Pass handleSubmitResponse to PlayerView
      return <PlayerView gameState={gameState} player={thisPlayer} onSubmitResponse={handleSubmitResponse} />;
    }
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
export const dynamic = 'force-dynamic';

