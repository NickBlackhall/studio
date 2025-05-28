
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play, Loader2, UserCircle } from 'lucide-react';
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
          localGameId = initialGameState.gameId; 
          const playerIdFromStorage = localStorage.getItem(`thisPlayerId_game_${localGameId}`);
          console.log(`GamePage: For gameId ${localGameId}, player ID from storage: ${playerIdFromStorage}`);

          if (playerIdFromStorage) {
            const playerInGameList = initialGameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGameList) {
                console.log(`GamePage: Player ${playerIdFromStorage} found in initial game state players list.`);
                // Ensure hand is an array even if fetched player details are minimal initially
                setThisPlayer({ ...playerInGameList, hand: playerInGameList.hand || [] });
            } else {
                console.log(`GamePage: Player ${playerIdFromStorage} NOT in initial game state players list. Attempting direct fetch.`);
                const playerDetail = await getCurrentPlayer(playerIdFromStorage, localGameId);
                 // Ensure hand is an array even if fetched player details are minimal initially
                setThisPlayer(playerDetail ? { ...playerDetail, hand: playerDetail.hand || [] } : null);
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
        setThisPlayer(null); 
      } finally {
        setIsLoading(false);
        console.log("GamePage: Initial data fetch sequence ended.");
      }
    }
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); 

  useEffect(() => {
    if (!gameState || !gameState.gameId) {
      console.log("GamePage Realtime: Skipping subscription setup (no game/gameId).");
      return;
    }
    const gameId = gameState.gameId; 
    console.log(`GamePage Realtime: Setting up subscriptions for gameId: ${gameId}`);

    const channelsToSubscribe = [
      { table: 'games', filter: `id=eq.${gameId}`, eventName: 'game-updates' },
      { table: 'players', filter: `game_id=eq.${gameId}`, eventName: 'players-updates' },
      { table: 'player_hands', filter: `game_id=eq.${gameId}`, eventName: 'player-hands-updates' },
      { table: 'responses', filter: `game_id=eq.${gameId}`, eventName: 'submissions-updates' },
    ];

    const commonPayloadHandler = async (originTable: string, payload: any) => {
      console.log(`>>> GamePage Realtime (${originTable} sub for game ${gameId}): CHANGE DETECTED!`, payload);
      try {
        const updatedFullGame = await getGame();
        setGameState(updatedFullGame);
        console.log(`GamePage Realtime: Game state updated from ${originTable} event. GameID: ${updatedFullGame?.gameId}, Phase: ${updatedFullGame?.gamePhase}, Players: ${updatedFullGame?.players?.length}`);
        
        if (thisPlayer?.id && updatedFullGame?.gameId) {
          // Only refresh current player if gameId matches, critical for stability
          if (updatedFullGame.gameId === gameId) {
            const latestPlayerDetails = await getCurrentPlayer(thisPlayer.id, updatedFullGame.gameId);
            setThisPlayer(latestPlayerDetails ? { ...latestPlayerDetails, hand: latestPlayerDetails.hand || [] } : null);
            console.log(`GamePage Realtime: Refreshed thisPlayer details. ID: ${latestPlayerDetails?.id}, Hand: ${latestPlayerDetails?.hand?.length}`);
          } else {
            console.warn(`GamePage Realtime: Game ID mismatch after update. Current Game: ${gameId}, Updated Game: ${updatedFullGame.gameId}. Not refreshing thisPlayer.`);
          }
        }
      } catch (error) {
        console.error(`GamePage Realtime: Error processing ${originTable} update:`, error);
      }
    };

    const activeChannels: any[] = [];

    channelsToSubscribe.forEach(({ table, filter, eventName }) => {
      const channel = supabase
        .channel(`${eventName}-${gameId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter },
          (payload) => commonPayloadHandler(table, payload)
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.log(`GamePage Realtime: Subscribed to ${eventName}-${gameId}`);
          if (err) console.error(`GamePage Realtime: Error on ${eventName}-${gameId} subscription:`, err);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`GamePage Realtime: Channel error for ${eventName}-${gameId}: ${status}`, err);
          }
        });
      activeChannels.push(channel);
    });

    return () => {
      console.log(`GamePage Realtime: Cleaning up subscriptions for gameId: ${gameId}`);
      activeChannels.forEach(channel => supabase.removeChannel(channel).catch(err => console.error("GamePage Realtime: Error removing channel:", err)));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.gameId, thisPlayer?.id]); // Added thisPlayer?.id to re-evaluate if player changes


  const handleStartGame = async () => {
    if (gameState?.gameId && gameState.gamePhase === 'lobby') {
      startTransition(async () => {
        console.log("GamePage: Client calling startGame server action.");
        try {
          await startGame(gameState.gameId);
          // State update will be handled by realtime subscription
          toast({ title: "Game Starting!", description: "The judge is being assigned and cards dealt." });
        } catch (error: any) {
          console.error("GamePage: Error starting game:", error);
          toast({title: "Cannot Start", description: error.message || "Failed to start game.", variant: "destructive"});
        }
      });
    } else {
      toast({title: "Cannot Start", description: "Game not in lobby or no game ID.", variant: "destructive"})
    }
  };
  
  const handleSelectCategory = async (category: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        try {
          await selectCategory(gameState.gameId, category);
           toast({ title: "Category Selected!", description: `Scenario from "${category}" is up!` });
        } catch (error: any) {
          console.error("GamePage: Error selecting category:", error);
          toast({title: "Category Error", description: error.message || "Failed to select category.", variant: "destructive"});
        }
      });
    }
  };

  const handleSubmitResponse = async (responseCardText: string) => { 
    if (thisPlayer && gameState && gameState.currentRound > 0 && responseCardText && gameState.currentScenario) {
        // Find the card ID from the player's hand that matches the submitted text.
        // This assumes `thisPlayer.hand` contains the text of the cards.
        // And `player_hands` table is used to link `player_id` to `response_card_id`.
        // We need to query `player_hands` JOIN `response_cards` or have card IDs in `thisPlayer.hand`.
        
        // For now, we need to get the actual response_card_id that corresponds to the text.
        // This is a temporary lookup. Ideally, PlayerView passes the ID.
        const { data: cardData, error: cardError } = await supabase
            .from('player_hands')
            .select('response_card_id, response_cards!inner(text)')
            .eq('player_id', thisPlayer.id)
            .eq('game_id', gameState.gameId)
            .eq('response_cards.text', responseCardText) 
            .single();

        if (cardError || !cardData) {
            console.error("Error finding card ID for submission:", cardError);
            toast({title: "Submission Error", description: "Could not find the card you tried to submit.", variant: "destructive"});
            return;
        }
        const cardIdToSubmit = cardData.response_card_id;

        startTransition(async () => {
            try {
              await submitResponse(thisPlayer.id, cardIdToSubmit, gameState.gameId, gameState.currentRound);
              toast({ title: "Response Sent!", description: "Your terrible choice is in. Good luck!" });
            } catch (error: any) {
              console.error("GamePage: Error submitting response:", error);
              toast({title: "Submit Error", description: error.message || "Failed to submit response.", variant: "destructive"});
            }
        });
    } else {
        toast({title: "Cannot Submit", description: "Submission conditions not met (no player, game, round, card, or scenario).", variant: "destructive"});
    }
  };
  
  const handleSelectWinner = async (winningCardText: string) => {
    if (gameState?.gameId) {
      startTransition(async () => {
        try {
          await selectWinner(winningCardText, gameState.gameId);
          // Winner announcement will be driven by game state change
        } catch (error: any) {
          console.error("GamePage: Error selecting winner:", error);
          toast({title: "Winner Selection Error", description: error.message || "Failed to select winner.", variant: "destructive"});
        }
      });
    }
  };

  const handleNextRound = async () => {
    if (gameState?.gameId) {
      startTransition(async () => {
        try {
          await nextRound(gameState.gameId);
          toast({ title: "Next Round!", description: "The terror continues..." });
        } catch (error: any) {
          console.error("GamePage: Error starting next round:", error);
          toast({title: "Next Round Error", description: error.message || "Failed to start next round.", variant: "destructive"});
        }
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
  
  // Lobby view specific to the /game page (before game officially starts by this client)
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
      <main className="flex-grow w-full md:w-2/3 lg:w-3/4 relative"> {/* Added relative for pending loader positioning */}
        {isPending && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-50 rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )}
        {thisPlayer && (
          <Card className="mb-4 bg-muted border-primary shadow">
            <CardContent className="p-3 flex items-center justify-center text-center">
              <UserCircle className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm text-primary font-medium">
                You are: <span className="text-2xl mx-1">{thisPlayer.avatar}</span><strong>{thisPlayer.name}</strong>
              </p>
            </CardContent>
          </Card>
        )}
        {renderGameContent()}
      </main>
    </div>
  );
}
export const dynamic = 'force-dynamic';


      