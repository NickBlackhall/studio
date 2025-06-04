
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, ThumbsUp, CheckSquare, XSquare, HelpCircle, Info, Lock } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import CurrentYear from '@/components/CurrentYear';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';


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
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  
  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';

  const setGame = useCallback((newGameState: GameClientState | null) => {
    console.log(`Client (setGame callback): Called with newGameState. RPO: ${JSON.stringify(newGameState?.ready_player_order)}, Players: ${newGameState?.players?.length}`);
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

  const fetchGameData = useCallback(async (origin: string = "unknown", gameIdToFetch?: string) => {
    console.log(`Client (fetchGameData): Triggered from ${origin}. Game ID to fetch: ${gameIdToFetch || 'N/A'}. Current gameId from ref: ${gameRef.current?.gameId}`);
    const isInitialOrResetCall = origin === "initial mount" || origin.includes("reset") || origin.includes("useEffect[] mount") || (!gameRef.current?.gameId && !gameIdToFetch);
    
    if (isInitialOrResetCall && isMountedRef.current) {
      // setIsLoading(true); // Managed by global loader
    }
    
    try {
      const fetchedGameState = await getGame(gameIdToFetch); 
      console.log(`Client (fetchGameData): Game state fetched via getGame(${gameIdToFetch || ''}) (from ${origin}):`, 
                  fetchedGameState ? `ID: ${fetchedGameState.gameId}, Phase: ${fetchedGameState.gamePhase}, Players: ${fetchedGameState.players.length}, RPO from fetched: ${JSON.stringify(fetchedGameState?.ready_player_order)}` : "null");
      
      if (!isMountedRef.current) {
        console.log(`Client (fetchGameData): Component unmounted after getGame() call (from ${origin}).`);
        return;
      }

      setGame(fetchedGameState); 

      if (fetchedGameState && fetchedGameState.gameId) {
        const localStorageKey = `thisPlayerId_game_${fetchedGameState.gameId}`;
        
        if (fetchedGameState.players.length === 0 && (origin.includes("reset") || origin.includes("handleResetGame"))) {
          console.log(`Client (fetchGameData): Fetched game state shows 0 players for game ${fetchedGameState.gameId} after reset. Forcefully clearing localStorage and thisPlayerId (from ${origin}).`);
          localStorage.removeItem(localStorageKey);
          setThisPlayerId(null);
        } else {
          const playerIdFromStorage = localStorage.getItem(localStorageKey);
          console.log(`Client (fetchGameData): For gameId ${fetchedGameState.gameId}, player ID from storage: ${playerIdFromStorage} (from ${origin}).`);
          if (playerIdFromStorage) {
            const playerInGame = fetchedGameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGame) {
              setThisPlayerId(playerIdFromStorage);
            } else {
              console.warn(`Client (fetchGameData): Player ${playerIdFromStorage} NOT in game.players list for game ${fetchedGameState.gameId}. Clearing localStorage (from ${origin}).`);
              localStorage.removeItem(localStorageKey);
              setThisPlayerId(null);
            }
          } else {
            setThisPlayerId(null); 
          }
        }
        const finalPlayerIdForLog = isMountedRef.current ? (localStorage.getItem(localStorageKey) || thisPlayerIdRef.current || null) : null;
        console.log(`Client (fetchGameData): thisPlayerId ultimately set to: ${finalPlayerIdForLog} after fetch from ${origin}.`);

      } else { 
        setThisPlayerId(null);
        console.warn(`Client (fetchGameData): Game state is null or no gameId from fetch (origin: ${origin}). thisPlayerId set to null. Last good gameId from ref: ${gameRef.current?.gameId}`);
        if (isInitialOrResetCall && isMountedRef.current) {
            setGame(null); 
            toast({ title: "Game Session Error", description: "Could not initialize or find the game session. Please try refreshing or resetting.", variant: "destructive"});
        }
      }
    } catch (error: any) {
      console.error(`Client (fetchGameData): Failed to fetch game state (from ${origin}, gameIdToFetch: ${gameIdToFetch || 'N/A'}):`, error);
      if (isMountedRef.current) {
        if (gameIdToFetch) {
            toast({ title: "Game Update Failed", description: `Could not refresh game ${gameIdToFetch}: ${error.message}. State may be temporarily stale.`, variant: "default"});
        } else {
            setGame(null);
            setThisPlayerId(null);
            toast({ title: "Load Error", description: `Could not fetch game state: ${error.message || String(error)}`, variant: "destructive"});
        }
      }
    } finally {
      if (isInitialOrResetCall && isMountedRef.current) {
         setIsLoading(false); 
         hideGlobalLoader(); 
         console.log(`Client (fetchGameData): Operation from ${origin} completed. isLoading is now false.`);
      } else if (isMountedRef.current) {
         console.log(`Client (fetchGameData): Operation from ${origin} (non-initial) completed.`);
      } else {
         console.log(`Client (fetchGameData): Operation from ${origin} completed, but component unmounted. Loaders NOT set by this call.`);
      }
    }
  }, [toast, setGame, setThisPlayerId, hideGlobalLoader]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log(`Client (useEffect[]): Component mounted or currentStep changed to: ${currentStep}. Fetching game data.`);
    showGlobalLoader(); 
    fetchGameData(`useEffect[] mount or currentStep change to: ${currentStep}`);
    
    return () => {
      console.log(`Client (useEffect[] cleanup): Component unmounting or currentStep changing from: ${currentStep}. Setting isMountedRef to false.`);
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);


  useEffect(() => {
    const gameForNavCheck = internalGame; 
    const localThisPlayerId = internalThisPlayerId; 
    console.log(`Client (useEffect nav check): Running. internalGame phase: ${internalGame?.gamePhase}, Game ID: ${gameForNavCheck ? gameForNavCheck.gameId : 'N/A'}, Phase: ${gameForNavCheck?.gamePhase}, Step: ${currentStep}, Mounted: ${isMountedRef.current}, thisPlayerId: ${localThisPlayerId}`);

    if (isMountedRef.current && gameForNavCheck && gameForNavCheck.gameId &&
        gameForNavCheck.gamePhase !== 'lobby' && 
        ACTIVE_PLAYING_PHASES.includes(gameForNavCheck.gamePhase as GamePhaseClientState) && 
        currentStep === 'setup' &&
        localThisPlayerId 
      ) {
      console.log(`Client (useEffect nav check): NAV CONDITION MET for existing player. Phase: ${gameForNavCheck.gamePhase}, Step: ${currentStep}, PlayerID: ${localThisPlayerId}. Showing loader and navigating to /game.`);
      showGlobalLoader();
      router.push('/game');
    } else if (isMountedRef.current && gameForNavCheck && gameForNavCheck.gameId &&
        gameForNavCheck.gamePhase !== 'lobby' &&
        currentStep === 'setup' &&
        !localThisPlayerId 
      ) {
        console.log(`Client (useEffect nav check): Game is active (${gameForNavCheck.gamePhase}) but this user (PlayerID: ${localThisPlayerId}) is not part of it. Staying on setup page to show 'Game in Progress' message / spectator info.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [internalGame, internalThisPlayerId, currentStep, router, showGlobalLoader]);


  useEffect(() => {
    const currentGameId = internalGame?.gameId; 
    const currentThisPlayerId = internalThisPlayerId;

    if (!currentGameId || isLoading) { 
      console.log(`Client (Realtime): No gameId from internalGame, or still loading, skipping subscription setup. Game ID: ${currentGameId || 'N/A'}, isLoading: ${isLoading} on WelcomePage (currentStep: ${currentStep}), thisPlayerId: ${currentThisPlayerId}`);
      return () => {};
    }

    console.log(`Client (Realtime): Setting up Supabase subscriptions for gameId: ${currentGameId} on WelcomePage (currentStep: ${currentStep}), thisPlayerId: ${currentThisPlayerId}`);
    const uniqueChannelSuffix = currentThisPlayerId || Date.now();

    const handlePlayersUpdate = async (payload: any) => {
      console.log(`>>> Client (Realtime): PLAYERS TABLE CHANGE DETECTED! Event: ${payload.eventType}, New data present: ${!!payload.new}`, payload.new || payload.old);
      const latestGameId = gameRef.current?.gameId; 
      if (isMountedRef.current && latestGameId) { 
        console.log(`Client (Realtime - players sub for game ${latestGameId}): Fetching updated game state due to players change...`);
        await fetchGameData(`players-lobby-${latestGameId}-${uniqueChannelSuffix} player change`, latestGameId);
      } else {
        console.log(`Client (Realtime - players sub): Skipping fetch, component unmounted or gameId missing. Current gameId from ref: ${latestGameId}`);
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      const newPhaseFromPayload = payload.new?.game_phase;
      const newRPOFromPayload = payload.new?.ready_player_order;
      console.log(`>>> Client (Realtime): GAMES TABLE CHANGE DETECTED! Payload phase: ${newPhaseFromPayload}, Payload RPO: ${JSON.stringify(newRPOFromPayload)}, Full payload:`, payload);
      const latestGameId = gameRef.current?.gameId; 
      if (isMountedRef.current && latestGameId) { 
        console.log(`Client (Realtime - games sub for game ${latestGameId}): Fetching updated game state due to games change (payload phase: ${newPhaseFromPayload})...`);
        const updatedFullGame = await getGame(latestGameId);
        if(updatedFullGame && isMountedRef.current) {
          console.log(`Client (Realtime - games sub for game ${latestGameId}): Fetched game state via getGame(), new phase: ${updatedFullGame.gamePhase}, new RPO: ${JSON.stringify(updatedFullGame.readyPlayerOrder)}. Setting local game state.`);
          setGame(updatedFullGame);
        } else if (isMountedRef.current) {
          console.warn(`Client (Realtime - games sub for game ${latestGameId}): getGame() returned null or component unmounted. Not setting local game state.`);
        }
      } else {
         console.log(`Client (Realtime - games sub): Skipping fetch, component unmounted or gameId missing. Current gameId from ref: ${latestGameId}`);
      }
    };
    
    const playersChannelName = `players-lobby-${currentGameId}-${uniqueChannelSuffix}`;
    const playersChannel = supabase
      .channel(playersChannelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${currentGameId}` },
        handlePlayersUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Client (Realtime): Successfully subscribed to ${playersChannelName} on WelcomePage!`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Client (Realtime): Subscription error (${playersChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        } else if (status === 'CLOSED') {
           console.info(`Client (Realtime): Channel ${playersChannelName} is now ${status}. Details:`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'No error details.');
        } else if (err) {
           console.error(`Client (Realtime): Unexpected error or status on ${playersChannelName} subscription (status: ${status}):`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        }
      });

    const gameChannelName = `game-state-lobby-${currentGameId}-${uniqueChannelSuffix}`;
    const gameChannel = supabase
      .channel(gameChannelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${currentGameId}` },
        handleGameTableUpdate
      )
      .subscribe((status, err) => {
         if (status === 'SUBSCRIBED') {
          console.log(`Client (Realtime): Successfully subscribed to ${gameChannelName} on WelcomePage!`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Client (Realtime): Subscription error (${gameChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        } else if (status === 'CLOSED') {
          console.info(`Client (Realtime): Channel ${gameChannelName} is now ${status}. Details:`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'No error details.');
        } else if (err) {
           console.error(`Client (Realtime): Unexpected error or status on ${gameChannelName} subscription (status: ${status}):`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        }
      });
      
    return () => {
      const gameIdForCleanup = gameRef.current?.gameId; 
      if (gameIdForCleanup) {
        console.log(`Client (Realtime cleanup): Cleaning up Supabase subscriptions for gameId: ${gameIdForCleanup}, suffix: ${uniqueChannelSuffix} on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
        supabase.removeChannel(playersChannel).catch(err => console.error("Client (Realtime cleanup): Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Client (Realtime cleanup): Error removing game channel on WelcomePage:", err));
      } else {
        console.log(`Client (Realtime cleanup): Skipping channel cleanup as game.gameId is missing from ref.`);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalGame?.gameId, internalThisPlayerId, currentStep, isLoading]); // Removed fetchGameData from deps to avoid loops


  const handleAddPlayer = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    const currentGameId = internalGame?.gameId; 

    if (!name.trim() || !avatar) {
        toast({ title: "Missing Info", description: "Please enter your name and select an avatar.", variant: "destructive" });
        return;
    }
    if (!currentGameId) {
        toast({ title: "Error!", description: "Game session not found. Please refresh.", variant: "destructive"});
        if (isMountedRef.current) {
            showGlobalLoader();
            await fetchGameData("handleAddPlayer_no_gameId"); 
        }
        return;
    }
    
    console.log(`Client (handleAddPlayer): Attempting to add player ${name} (avatar: ${avatar}) for gameId ${currentGameId}`);
    startPlayerActionTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        console.log('Client (handleAddPlayer): Add player action result:', newPlayer);

        if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id); 
          console.log(`Client (handleAddPlayer): Player ${newPlayer.id} added. Set thisPlayerId to ${newPlayer.id} and localStorage. Explicitly fetching game data for game ${currentGameId} for this client.`);
          await fetchGameData(`handleAddPlayer after action for game ${currentGameId}`, currentGameId); 
        } else if (isMountedRef.current) {
          console.error('Client (handleAddPlayer): Failed to add player or component unmounted. New player:', newPlayer, 'Game ID:', currentGameId, 'Mounted:', isMountedRef.current);
           if (newPlayer === null && internalGame?.gamePhase !== 'lobby') { 
            toast({ title: "Game in Progress", description: "Cannot join now. Please wait for the next game.", variant: "destructive"});
          } else if (newPlayer === null) { 
            toast({ title: "Join Error", description: "Could not add player to the game.", variant: "destructive"});
          }
        }
      } catch (error: any) {
        console.error("Client (handleAddPlayer): Error calling addPlayerAction:", error);
        if (isMountedRef.current) {
          const errorMsg = error.message || String(error);
           if (errorMsg.includes("Game is already in progress")) {
            toast({ title: "Game in Progress", description: "Cannot join now. Please wait for the next game.", variant: "destructive"});
          } else {
            toast({ title: "Error Adding Player", description: errorMsg, variant: "destructive"});
          }
        }
      }
    });
  };

  const handleResetGame = async () => {
    console.log("🔴 RESET (Client): Button clicked - calling resetGameForTesting server action.");
    showGlobalLoader(); 
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (!isMountedRef.current) {
            console.warn("🔴 RESET (Client): Component unmounted during reset operation.");
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
        if (isMountedRef.current) {
           hideGlobalLoader(); 
        }
      }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    const currentGameId = internalGame?.gameId; 
    const currentThisPlayerId = internalThisPlayerId; 

    if (!currentGameId || !currentThisPlayerId) {
        toast({ title: "Error", description: "Cannot change ready status. Game or player not identified.", variant: "destructive" });
        return;
    }
    if (player.id !== currentThisPlayerId) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    console.log(`Client (handleToggleReady): Toggling ready status for player ${player.name} (ID: ${player.id}) from ${player.isReady} for game ${currentGameId}`);
    startPlayerActionTransition(async () => {
      try {
        const updatedGameState = await togglePlayerReadyStatus(player.id, currentGameId);
        if (isMountedRef.current) {
          if (updatedGameState) {
            console.log(`Client (handleToggleReady): Game state received from action. Phase: ${updatedGameState.gamePhase}, RPO: ${JSON.stringify(updatedGameState.readyPlayerOrder)}. Current step: ${currentStep}`);
            setGame(updatedGameState); 
          } else {
            console.warn(`Client (handleToggleReady): togglePlayerReadyStatus returned null for game ${currentGameId}. Attempting fetchGameData as fallback.`);
            await fetchGameData(`handleToggleReady_null_fallback_game_${currentGameId}`, currentGameId);
          }
        }
      } catch (error: any) {
        if (isMountedRef.current) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            console.log("Client (handleToggleReady): Caught NEXT_REDIRECT during toggle ready. Showing loader. Allowing Next.js to handle navigation.");
            showGlobalLoader(); 
            return; 
          }
          console.error("Client (handleToggleReady): Error toggling ready status:", error);
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };

  const handleStartGame = async () => {
    const gameToStart = internalGame;
    if (gameToStart?.gameId && gameToStart.gamePhase === 'lobby') {
        showGlobalLoader();
        startPlayerActionTransition(async () => {
            try {
                await startGameAction(gameToStart.gameId);
            } catch (error: any) {
                if (isMountedRef.current) {
                    if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
                        console.log("Client (handleStartGame): Caught NEXT_REDIRECT. Loader will be handled by navigation target.");
                        return; 
                    }
                    toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
                    hideGlobalLoader();
                }
            }
        });
    }
  };
  
  const hostPlayerId = useMemo(() => {
    if (!internalGame || !Array.isArray(internalGame.ready_player_order)) return null;
    // Add log here to see what useMemo is working with
    console.log(`Client (useMemo for hostPlayerId): internalGame.RPO is: ${JSON.stringify(internalGame.ready_player_order)}`);
    return internalGame.ready_player_order.length > 0 ? internalGame.ready_player_order[0] : null;
  }, [internalGame]);

  const enoughPlayers = useMemo(() => {
    if (!internalGame || !internalGame.players) return false;
    return internalGame.players.length >= MIN_PLAYERS_TO_START;
  }, [internalGame]);

  const allPlayersReady = useMemo(() => {
    if (!internalGame || !internalGame.players || !enoughPlayers) return false;
    return internalGame.players.every(p => p.isReady);
  }, [internalGame, enoughPlayers]);


  if (isLoading && !internalGame ) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        {/* Global loader is active */}
      </div>
    );
  }
  
  if (!internalGame || !internalGame.gameId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Image src="/logo.png" alt="Make It Terrible Logo" width={365} height={109} className="mx-auto" data-ai-hint="game logo" priority style={{ height: 'auto' }} />
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => { showGlobalLoader(); window.location.reload(); }} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const thisPlayerObject = internalThisPlayerId && internalGame.players ? internalGame.players.find(p => p.id === internalThisPlayerId) : null;
  const gameIsActuallyActive = ACTIVE_PLAYING_PHASES.includes(internalGame.gamePhase as GamePhaseClientState);
  const isLobbyPhaseActive = internalGame.gamePhase === 'lobby';
  const isSpectatorView = gameIsActuallyActive && !thisPlayerObject;
  const isActivePlayerOnLobbyPage = gameIsActuallyActive && thisPlayerObject;


  if (currentStep === 'setup') {
    if (isSpectatorView) {
      return (
        <div className="w-full max-w-xl mx-auto space-y-6 text-center py-12">
           <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer mb-8 block mx-auto">
            <Image src="/logo.png" alt="Make It Terrible Logo" width={200} height={59} data-ai-hint="game logo" priority style={{ height: 'auto' }} />
          </button>
          <Card className="my-4 shadow-md border-2 border-destructive rounded-lg">
            <CardHeader className="p-4">
              <Lock className="h-8 w-8 mx-auto text-destructive mb-2" />
              <CardTitle className="text-xl font-semibold">Game in Progress!</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm">
                <p>Sorry, you&apos;ll have to wait until the next game to join. But you can still watch you pervert.</p>
                <p className="mt-1">Don&apos;t like waiting? Thank the idiot who programmed this thing...</p>
            </CardContent>
          </Card>
          <div className="my-6">
            <h2 className="text-2xl font-semibold text-center mb-3 text-primary">Current Game Standings</h2>
            <Scoreboard players={internalGame.players} currentJudgeId={internalGame.currentJudgeId} />
          </div>
          <Card className="shadow-md border-muted rounded-lg">
            <CardContent className="p-6">
              <p className="text-muted-foreground">The lobby will re-open once the current game finishes. Hang tight!</p>
            </CardContent>
          </Card>
           <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction || isLoading}>
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
          </Button>
        </div>
      );
    } else if (isActivePlayerOnLobbyPage) {
      return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
           <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer mb-8">
            <Image src="/logo.png" alt="Make It Terrible Logo" width={200} height={59} data-ai-hint="game logo" priority style={{ height: 'auto' }} />
          </button>
          <Card className="my-4 border-primary/50 bg-muted/30 shadow-md w-full max-w-md text-center">
            <CardHeader className="p-4">
              <CardTitle className="text-lg flex items-center justify-center font-semibold text-foreground">
                <Info className="mr-2 h-5 w-5 text-primary" /> Game in Progress!
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
              <p>The current game is in the &quot;{internalGame.gamePhase}&quot; phase.</p>
              <Button
                onClick={() => { showGlobalLoader(); router.push('/game'); }}
                variant="default"
                size="sm"
                className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Rejoin Current Game <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
           <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction || isLoading}>
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
          </Button>
        </div>
      );
    } else if (isLobbyPhaseActive) {
      const showPlayerSetupForm = !thisPlayerObject && isLobbyPhaseActive;
      
      const debugRPO = internalGame.ready_player_order || [];
      const calculatedHostPlayerId = debugRPO.length > 0 ? debugRPO[0] : null;
      
      console.log("===== START GAME BUTTON DEBUG (WelcomePage - isLobbyPhaseActive) =====");
      console.log("Current Game Phase:", internalGame.gamePhase);
      console.log("thisPlayerIdRef.current (Current User's ID):", thisPlayerIdRef.current);
      console.log("thisPlayerObject (Current User's Player Data):", thisPlayerObject ? {id: thisPlayerObject.id, name: thisPlayerObject.name, isReady: thisPlayerObject.isReady} : null);
      console.log("hostPlayerId (from useMemo):", hostPlayerId); 
      console.log("Full ready_player_order array (from internalGame for debug):", JSON.stringify(debugRPO));
      console.log("Is thisPlayerIdRef.current NOT null?:", thisPlayerIdRef.current !== null);
      console.log("Is thisPlayer host? (thisPlayerIdRef.current === hostPlayerId from useMemo):", thisPlayerIdRef.current === hostPlayerId);
      console.log("Enough Players?:", enoughPlayers);
      console.log("All Players Ready?:", allPlayersReady);
      
      const showStartGameButton = 
        thisPlayerIdRef.current !== null &&
        thisPlayerIdRef.current === hostPlayerId && 
        enoughPlayers &&
        allPlayersReady;
      console.log("Overall: Should showStartGameButton be true?:", showStartGameButton);
      console.log("===================================================================");
      
      let lobbyMessage = "";
      if (!enoughPlayers) {
        lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players to start. Waiting for ${MIN_PLAYERS_TO_START - (internalGame.players?.length || 0)} more...`;
      } else if (!allPlayersReady) {
        const unreadyCount = internalGame.players?.filter(p => !p.isReady).length || 0;
        lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to be ready. Host can then start.`;
      } else if (showStartGameButton) { 
        lobbyMessage = "All players are ready! You can start the game now!";
      } else { 
        const hostPlayerForMsg = hostPlayerId && internalGame.players ? internalGame.players.find(p => p.id === hostPlayerId) : null;
        const hostNameForMessage = hostPlayerForMsg?.name || ( (debugRPO?.length || 0) > 0 ? 'first player to ready up' : 'the host');
        lobbyMessage = `All players ready! Waiting for ${hostNameForMessage} to start the game.`;
      }
      
      return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
          <header className="mb-12 text-center">
            <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer">
              <Image src="/logo.png" alt="Make It Terrible Logo" width={200} height={59} className="mx-auto mb-4" data-ai-hint="game logo" priority style={{ height: 'auto' }} />
            </button>
            <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
            {isLobbyPhaseActive && (
              <>
                {thisPlayerObject && <p className="text-xl text-muted-foreground mt-2">Welcome, {thisPlayerObject.name}! Tap your &apos;Ready&apos; button below.</p>}
                {showPlayerSetupForm && <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then tap your ready button!</p>}
              </>
            )}
          </header>
          
          <div className={cn("grid gap-8 w-full max-w-4xl", showPlayerSetupForm ? "md:grid-cols-2" : "md:grid-cols-1")}>
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
            
            <Card className={cn("shadow-2xl border-2 border-secondary rounded-xl overflow-hidden", !showPlayerSetupForm && "md:col-span-1")}>
              <CardHeader className="bg-secondary text-secondary-foreground p-6">
                <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players ({internalGame.players.length})</CardTitle>
                <CardDescription className="text-secondary-foreground/80 text-base">
                  Game starts when host initiates after all players are ready.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {internalGame.players.length > 0 ? (
                  <ul className="space-y-3">
                    {internalGame.players.map((player: PlayerClientState) => (
                      <li key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg shadow">
                        <div className="flex items-center">
                          {player.avatar.startsWith('/') ? (
                            <Image src={player.avatar} alt={`${player.name}'s avatar`} width={40} height={40} className="mr-3 rounded-sm object-contain" style={{ width: '40px', height: '40px' }} />
                          ) : (
                            <span className="text-3xl mr-3">{player.avatar}</span>
                          )}
                          <span className="text-xl font-medium text-foreground">{player.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {player.id === internalThisPlayerId ? ( 
                            <Button
                              onClick={() => handleToggleReady(player)}
                              variant={player.isReady ? "default" : "outline"}
                              size="sm"
                              className={cn("px-3 py-1 text-xs font-semibold", player.isReady ? "bg-green-500 hover:bg-green-600 text-white border-green-600" : "border-primary text-primary hover:bg-primary/10")}
                              disabled={isProcessingAction}
                            >
                              {isProcessingAction && player.id === internalThisPlayerId ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (player.isReady ? <ThumbsUp className="mr-1 h-3 w-3"/> : null)}
                              {player.isReady ? "Ready!" : "Tap when Ready"}
                            </Button>
                          ) : (
                            player.isReady ? <CheckSquare className="h-6 w-6 text-green-500" title="Ready" /> : <XSquare className="h-6 w-6 text-red-500" title="Not Ready" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No players yet. Be the first to cause some trouble!</p>
                )}

                {showStartGameButton && (
                    <Button
                      onClick={handleStartGame}
                      variant="default"
                      size="lg"
                      className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90 text-xl font-bold py-6 shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out"
                      disabled={isProcessingAction || isLoading}
                    >
                      { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-7 w-7" /> }
                      🚀 Start Game Now!
                    </Button>
                )}
                {lobbyMessage && (
                    <p className="text-sm text-center mt-4 text-yellow-600 dark:text-yellow-400 font-semibold">{lobbyMessage}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-4">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" className="border-accent text-accent-foreground hover:bg-accent/80"><HelpCircle className="mr-2 h-5 w-5" /> How to Play</Button></DialogTrigger>
              <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
            </Dialog>
            <Button onClick={handleResetGame} variant="destructive" className="hover:bg-destructive/80" disabled={isProcessingAction || isLoading }>
              { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
            </Button>
          </div>
          <footer className="mt-12 text-center text-sm text-muted-foreground"><p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p></footer>
        </div>
      );
    }
  }

  // Fallback for initial "welcome" step (before ?step=setup)
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground text-center">
      <Image src="/logo.png" alt="Make It Terrible Logo" width={365} height={109} className="mx-auto mb-8" data-ai-hint="game logo" priority style={{ height: 'auto' }} />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
      <p className="text-2xl text-muted-foreground mb-10">The game of awful choices and hilarious outcomes!</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Button onClick={() => { showGlobalLoader(); router.push('/?step=setup');}} variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-2xl px-10 py-8 font-bold shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out">
          Join the Mayhem <ArrowRight className="ml-3 h-7 w-7" />
        </Button>
        <Dialog>
          <DialogTrigger asChild><Button variant="outline" size="lg" className="text-lg px-8 py-7"><HelpCircle className="mr-2 h-6 w-6" /> How to Play</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
        </Dialog>
      </div>
      <footer className="absolute bottom-8 text-center text-sm text-muted-foreground w-full"><p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p></footer>
    </div>
  );
}
    

    
