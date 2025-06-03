
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
import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
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

  const fetchGameData = useCallback(async (origin: string = "unknown") => {
    console.log(`Client: fetchGameData triggered from ${origin}. Current gameId from ref: ${gameRef.current?.gameId}`);
    const isInitialOrResetCall = origin === "initial mount" || origin.includes("reset") || origin.includes("useEffect[] mount") || !gameRef.current?.gameId;
    
    if (isInitialOrResetCall && isMountedRef.current) {
    }
    
    try {
      const fetchedGameState = await getGame();
      console.log(`Client: Game state fetched via getGame() (from ${origin}):`, fetchedGameState ? `ID: ${fetchedGameState.gameId}, Phase: ${fetchedGameState.gamePhase}, Players: ${fetchedGameState.players.length}, RPO: ${JSON.stringify(fetchedGameState?.readyPlayerOrder)}` : "null");
      
      if (!isMountedRef.current) {
        console.log(`Client: fetchGameData from ${origin} - component unmounted after getGame() call.`);
        return;
      }

      setGame(fetchedGameState); 

      if (fetchedGameState && fetchedGameState.gameId) {
        const localStorageKey = `thisPlayerId_game_${fetchedGameState.gameId}`;
        
        if (fetchedGameState.players.length === 0 && (origin.includes("reset") || origin.includes("handleResetGame"))) {
          console.log(`Client: Fetched game state shows 0 players for game ${fetchedGameState.gameId} after reset. Forcefully clearing localStorage and thisPlayerId (from ${origin}).`);
          localStorage.removeItem(localStorageKey);
          setThisPlayerId(null);
        } else {
          const playerIdFromStorage = localStorage.getItem(localStorageKey);
          console.log(`Client: For gameId ${fetchedGameState.gameId}, player ID from storage: ${playerIdFromStorage} (from ${origin}).`);
          if (playerIdFromStorage) {
            const playerInGame = fetchedGameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGame) {
              setThisPlayerId(playerIdFromStorage);
            } else {
              console.warn(`Client: Player ${playerIdFromStorage} NOT in game.players list for game ${fetchedGameState.gameId}. Clearing localStorage (from ${origin}).`);
              localStorage.removeItem(localStorageKey);
              setThisPlayerId(null);
            }
          } else {
            setThisPlayerId(null);
          }
        }
        const finalPlayerIdForLog = isMountedRef.current ? (localStorage.getItem(localStorageKey) || thisPlayerIdRef.current || null) : null;
        console.log(`Client: thisPlayerId ultimately set to: ${finalPlayerIdForLog} after fetch from ${origin}.`);

      } else { 
        setThisPlayerId(null);
        console.warn(`Client: Game state is null or no gameId from fetchGameData (origin: ${origin}). thisPlayerId set to null. Last good gameId from ref: ${gameRef.current?.gameId}`);
        if (isInitialOrResetCall && isMountedRef.current) {
            setGame(null); 
            toast({ title: "Game Session Error", description: "Could not initialize or find the game session. Please try refreshing or resetting.", variant: "destructive"});
        }
      }
    } catch (error: any) {
      console.error(`Client: Failed to fetch game state (from ${origin}):`, error);
      if (isMountedRef.current) {
        toast({ title: "Load Error", description: `Could not update game state: ${error.message || String(error)}`, variant: "destructive"});
        if (isInitialOrResetCall) {
          setGame(null);
          setThisPlayerId(null);
        }
      }
    } finally {
      if (isInitialOrResetCall && isMountedRef.current) {
         setIsLoading(false); 
         hideGlobalLoader(); 
         console.log(`Client: fetchGameData from ${origin} completed. isLoading is now false.`);
      } else if (isMountedRef.current) {
         console.log(`Client: fetchGameData from ${origin} (non-initial) completed.`);
      } else {
         console.log(`Client: fetchGameData from ${origin} completed, but component unmounted. Loaders NOT set by this call.`);
      }
    }
  }, [toast, setGame, setThisPlayerId, hideGlobalLoader]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log(`Client: Component mounted or currentStep changed to: ${currentStep}. Fetching game data.`);
    showGlobalLoader(); 
    fetchGameData(`useEffect[] mount or currentStep change to: ${currentStep}`);
    
    return () => {
      console.log(`Client: Component unmounting or currentStep changing from: ${currentStep}. Setting isMountedRef to false.`);
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);


  useEffect(() => {
    const gameForNavCheck = gameRef.current; 
    const localThisPlayerId = thisPlayerIdRef.current;
    console.log(`Client (useEffect nav check): Running. internalGame phase: ${internalGame?.gamePhase}, Game from ref: ${gameForNavCheck ? gameForNavCheck.gameId : 'N/A'}, Phase from ref: ${gameForNavCheck?.gamePhase}, Step: ${currentStep}, Mounted: ${isMountedRef.current}, thisPlayerIdRef: ${localThisPlayerId}`);

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
        console.log(`Client (useEffect nav check): Game is active (${gameForNavCheck.gamePhase}) but this user (PlayerID: ${localThisPlayerId}) is not part of it. Staying on setup page to show 'Game in Progress' message.`);
    }
  }, [internalGame, currentStep, router, showGlobalLoader]);


  useEffect(() => {
    const currentGameIdFromRef = gameRef.current?.gameId; 
    const currentThisPlayerIdFromRef = thisPlayerIdRef.current;

    if (!currentGameIdFromRef || isLoading) { 
      console.log(`Realtime or Redirect: No gameId from ref, or still loading, skipping subscription setup. Game ID from ref: ${currentGameIdFromRef || 'N/A'}, isLoading: ${isLoading} on WelcomePage (currentStep: ${currentStep}), thisPlayerId from ref: ${currentThisPlayerIdFromRef}`);
      return () => {};
    }

    console.log(`Realtime: Setting up Supabase subscriptions for gameId: ${currentGameIdFromRef} on WelcomePage (currentStep: ${currentStep}), thisPlayerId: ${currentThisPlayerIdFromRef}`);
    const uniqueChannelSuffix = currentThisPlayerIdFromRef || Date.now();

    const handlePlayersUpdate = async (payload: any) => {
      console.log(`>>> Realtime: PLAYERS TABLE CHANGE DETECTED BY SUPABASE! Event: ${payload.eventType}, New data present: ${!!payload.new}`, payload.new || payload.old);
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) { 
        console.log(`Realtime (players sub for game ${latestGameId}): Fetching updated game state due to players change...`);
        await fetchGameData(`players-lobby-${latestGameId}-${uniqueChannelSuffix} player change`);
      } else {
        console.log(`Realtime (players sub): Skipping fetch, component unmounted or gameId missing. Current gameId from ref: ${latestGameId}`);
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      const newPhaseFromPayload = payload.new?.game_phase;
      const newRPOFromPayload = payload.new?.ready_player_order;
      console.log(`>>> Realtime: GAMES TABLE CHANGE DETECTED BY SUPABASE! Payload phase: ${newPhaseFromPayload}, Payload RPO: ${JSON.stringify(newRPOFromPayload)}, Full payload:`, payload);
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) { 
        console.log(`Realtime (games sub for game ${latestGameId}): Fetching updated game state due to games change (payload phase: ${newPhaseFromPayload})...`);
        const updatedFullGame = await getGame(latestGameId); 
        if (updatedFullGame && isMountedRef.current) {
           console.log(`Realtime (games sub for game ${latestGameId}): Fetched game state via getGame(), new phase: ${updatedFullGame.gamePhase}, new RPO: ${JSON.stringify(updatedFullGame.readyPlayerOrder)}. Setting local game state.`);
           setGame(updatedFullGame);
        } else if (isMountedRef.current) {
            console.warn(`Realtime (games sub for game ${latestGameId}): updatedFullGame was null or component unmounted after fetch.`);
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
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime: Successfully subscribed to ${playersChannelName} on WelcomePage!`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (${playersChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
          if (err) { console.dir(err); }
        } else if (status === 'CLOSED') {
          if (err) {
            console.warn(`Realtime: Channel ${playersChannelName} closed with error:`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
            if (err) { console.warn('Realtime: Full error object details for players channel (CLOSED event):', err); console.dir(err); }
          } else {
            console.info(`Realtime: Channel ${playersChannelName} is now ${status}. This is often due to explicit unsubscription or component unmount.`);
          }
        } else if (err) {
           console.error(`Realtime: Unexpected error or status on ${playersChannelName} subscription (status: ${status}):`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
           if (err) { console.error('Realtime: Full error object details for players channel (unexpected status):', err); console.dir(err); }
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
         if (status === 'SUBSCRIBED') {
          console.log(`Realtime: Successfully subscribed to ${gameChannelName} on WelcomePage!`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime: Subscription error (${gameChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
          if (err) { console.dir(err); }
        } else if (status === 'CLOSED') {
          if (err) {
            console.warn(`Realtime: Channel ${gameChannelName} closed with error:`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
            if (err) { console.warn('Realtime: Full error object details for games channel (CLOSED event):', err); console.dir(err); }
          } else {
            console.info(`Realtime: Channel ${gameChannelName} is now ${status}. This is often due to explicit unsubscription or component unmount.`);
          }
        } else if (err) {
           console.error(`Realtime: Unexpected error or status on ${gameChannelName} subscription (status: ${status}):`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
           if (err) { console.error('Realtime: Full error object details for games channel (unexpected status):', err); console.dir(err); }
        }
      });
      
    return () => {
      const gameIdForCleanup = gameRef.current?.gameId; 
      if (gameIdForCleanup) {
        console.log(`Realtime: Cleaning up Supabase subscriptions for gameId: ${gameIdForCleanup}, suffix: ${uniqueChannelSuffix} on WelcomePage (unmount/re-effect for currentStep: ${currentStep})`);
        supabase.removeChannel(playersChannel).catch(err => console.error("Realtime: Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Realtime: Error removing game channel on WelcomePage:", err));
      } else {
        console.log(`Realtime: Skipping channel cleanup as game.gameId is missing from ref.`);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRef.current?.gameId, thisPlayerIdRef.current, currentStep, isLoading]);


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
        if (isMountedRef.current) {
            showGlobalLoader();
            await fetchGameData("handleAddPlayer_no_gameId");
        }
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
          console.log(`Client: Player ${newPlayer.id} added. Set thisPlayerId to ${newPlayer.id} and localStorage. Fetching game data for game ${currentGameId}.`);
          await fetchGameData(`handleAddPlayer after action for game ${currentGameId}`); 
        } else if (isMountedRef.current) {
          console.error('Client: Failed to add player or component unmounted. New player:', newPlayer, 'Game ID:', currentGameId, 'Mounted:', isMountedRef.current);
           if (newPlayer === null && gameRef.current?.gamePhase !== 'lobby') { 
            toast({ title: "Game in Progress", description: "Cannot join now. Please wait for the next game.", variant: "destructive"});
          } else if (newPlayer === null) {
            toast({ title: "Join Error", description: "Could not add player to the game.", variant: "destructive"});
          }
        }
      } catch (error: any) {
        console.error("Client: Error calling addPlayerAction:", error);
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
    const currentGameId = gameRef.current?.gameId; 
    const currentThisPlayerId = thisPlayerIdRef.current; 

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
            console.log(`Client (handleToggleReady): Game state received from action. Phase: ${updatedGameState.gamePhase}, RPO: ${JSON.stringify(updatedGameState.readyPlayerOrder)}. Current step: ${currentStep}`);
            setGame(updatedGameState); 
          } else {
            console.warn(`Client (handleToggleReady): togglePlayerReadyStatus returned null for game ${currentGameId}. Attempting fetchGameData as fallback.`);
            await fetchGameData(`handleToggleReady_null_fallback_game_${currentGameId}`);
          }
        }
      } catch (error: any) {
        if (isMountedRef.current) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            console.log("Client (handleToggleReady): Caught NEXT_REDIRECT during toggle ready. Showing loader. Allowing Next.js to handle navigation.");
            showGlobalLoader();
            return; 
          }
          console.error("Client: Error toggling ready status:", error);
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };

  const handleStartGame = async () => {
    const gameToStart = gameRef.current;
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
  
  const gameForSetupRender = internalGame;

  if (isLoading && !gameForSetupRender ) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
      </div>
    );
  }
  
  if (!gameForSetupRender || !gameForSetupRender.gameId) {
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

  const thisPlayerObject = gameForSetupRender.players && gameForSetupRender.players.find(p => p.id === thisPlayerIdRef.current);
  const gameIsActuallyActive = ACTIVE_PLAYING_PHASES.includes(gameForSetupRender.gamePhase as GamePhaseClientState);

  if (currentStep === 'setup') {
    if (!gameForSetupRender.players) { 
      return (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading player list...</p>
        </div>
      );
    }
    
    const enoughPlayers = gameForSetupRender.players.length >= MIN_PLAYERS_TO_START;
    const allPlayersReady = enoughPlayers && gameForSetupRender.players.every(p => p.isReady);
    
    const safeReadyPlayerOrder = Array.isArray(gameForSetupRender.readyPlayerOrder) ? gameForSetupRender.readyPlayerOrder : [];
    const hostPlayerId = safeReadyPlayerOrder.length > 0 ? safeReadyPlayerOrder[0] : null;
    
    let hostPlayer = null;
    if (hostPlayerId) {
      hostPlayer = gameForSetupRender.players.find(p => p.id === hostPlayerId);
      if (!hostPlayer) {
        console.warn(`Lobby Message: Host player object NOT FOUND for hostPlayerId: ${hostPlayerId}. Players list:`, gameForSetupRender.players.map(p => ({id: p.id, name: p.name})));
      }
    }

    let lobbyMessage = "";
    if (gameForSetupRender.gamePhase === 'lobby') {
      if (!enoughPlayers) {
        lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players to start. Waiting for ${MIN_PLAYERS_TO_START - gameForSetupRender.players.length} more...`;
      } else if (!allPlayersReady) {
        const unreadyCount = gameForSetupRender.players.filter(p => !p.isReady).length;
        lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to be ready. The host (${hostPlayer?.name || 'first player to ready up'}) can then start the game.`;
      } else if (hostPlayerId === thisPlayerIdRef.current) { 
        lobbyMessage = "All players are ready! You can start the game now!";
      } else { 
         lobbyMessage = `All players ready! Waiting for the host (${hostPlayer?.name || 'first player to ready up'}) to start the game.`;
      }
    }

    const showPlayerSetupForm = !thisPlayerObject && gameForSetupRender.gamePhase === 'lobby';
    const showGameInProgressMessage = gameIsActuallyActive && !thisPlayerObject; 
    const showRejoinGameMessage = gameIsActuallyActive && thisPlayerObject; 

    const showStartGameButton = gameForSetupRender.gamePhase === 'lobby' &&
                               thisPlayerIdRef.current === hostPlayerId &&
                               enoughPlayers &&
                               allPlayersReady;
    

    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer">
            <Image
              src="/logo.png"
              alt="Make It Terrible Logo"
              width={200} 
              height={59}  
              className="mx-auto mb-4"
              data-ai-hint="game logo"
              priority
              style={{ height: 'auto' }}
            />
          </button>
          <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
           {showGameInProgressMessage && ( 
             <Card className="my-6 text-center shadow-xl border-4 border-destructive rounded-xl bg-gradient-to-br from-destructive/70 via-destructive to-destructive/60 text-destructive-foreground">
              <CardHeader className="p-6 sm:p-8">
                <Lock className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-destructive-foreground/80 mb-3 sm:mb-4" />
                <CardTitle className="text-3xl sm:text-4xl font-extrabold">Game in Progress!</CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0 sm:pt-0">
                 <p className="text-lg sm:text-xl">
                    Sorry, you&apos;ll have to wait until the next game to join.
                 </p>
                 <p className="text-md sm:text-lg mt-2">
                    Don&apos;t like waiting? Thank the idiot who programmed this thing...
                 </p>
              </CardContent>
            </Card>
          )}
          {showRejoinGameMessage && (
             <Card className="my-4 border-primary/50 bg-muted/30 shadow-md">
              <CardHeader className="p-4">
                <CardTitle className="text-lg flex items-center font-semibold text-foreground">
                  <Info className="mr-2 h-5 w-5 text-primary" /> Game in Progress!
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                 <p>The current game is in the &quot;{gameForSetupRender.gamePhase}&quot; phase.</p>
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
          )}
          {!showPlayerSetupForm && thisPlayerObject && gameForSetupRender.gamePhase === 'lobby' && (
            <p className="text-xl text-muted-foreground mt-2">
              Welcome, {thisPlayerObject.name}! Tap your &apos;Ready&apos; button below.
            </p>
          )}
          {showPlayerSetupForm && gameForSetupRender.gamePhase === 'lobby' && (
             <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then tap your ready button!</p>
          )}
        </header>
        
        {currentStep === 'setup' && gameForSetupRender.gamePhase === 'lobby' && (
          <Card className="my-4 p-4 border-dashed border-blue-500 bg-blue-50 text-blue-700 text-xs w-full max-w-md">
            <CardTitle className="text-sm mb-2">Debug Info (Lobby)</CardTitle>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all">
              <p><strong>Current Game Phase:</strong> {gameForSetupRender.gamePhase}</p>
              <p><strong>Current Player ID:</strong> {thisPlayerIdRef.current || "Not set"}</p>
              <p><strong>Ready Player Order:</strong> {JSON.stringify(safeReadyPlayerOrder)}</p>
              <p><strong>Host Player ID (ready_player_order[0]):</strong> {hostPlayerId || "N/A"}</p>
              <p><strong>Is Current Player Host?:</strong> {(thisPlayerIdRef.current === hostPlayerId).toString()}</p>
              <p><strong>Enough Players?:</strong> {enoughPlayers.toString()}</p>
              <p><strong>All Players Ready?:</strong> {allPlayersReady.toString()}</p>
              <p><strong>Show Start Button (Final Check)?:</strong> {showStartGameButton.toString()}</p>
            </pre>
            <hr className="my-2 border-blue-300"/>
            <details>
              <summary className="cursor-pointer text-blue-600">Full Game State (internalGame)</summary>
              <pre className="mt-1 text-xxs overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(gameForSetupRender, null, 2)}</pre>
            </details>
             <button 
                onClick={() => fetchGameData("DebugManualFetch")}
                className="mt-2 p-1 text-xs bg-blue-200 hover:bg-blue-300 rounded"
              >
                Force Client Fetch
              </button>
          </Card>
        )}

        <div className={cn(
            "grid gap-8 w-full max-w-4xl",
             showPlayerSetupForm ? "md:grid-cols-2" : "md:grid-cols-1",
             showGameInProgressMessage && "md:grid-cols-1"
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
          
          { (gameForSetupRender.gamePhase === 'lobby' || (gameIsActuallyActive && thisPlayerObject)) && (
            <Card className={cn(
                "shadow-2xl border-2 border-secondary rounded-xl overflow-hidden",
                (!showPlayerSetupForm && gameForSetupRender.gamePhase === 'lobby') && "md:col-span-2",
                (showGameInProgressMessage && !thisPlayerObject) && "md:col-span-2" 
            )}>
              <CardHeader className="bg-secondary text-secondary-foreground p-6">
                <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players ({gameForSetupRender.players.length})</CardTitle>
                  <CardDescription className="text-secondary-foreground/80 text-base">
                   {gameForSetupRender.gamePhase === 'lobby' ? "Game starts when all players are ready and host initiates." : `Current game phase: ${gameForSetupRender.gamePhase}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {gameForSetupRender.players.length > 0 ? (
                  <ul className="space-y-3">
                    {gameForSetupRender.players.map((player: PlayerClientState) => (
                      <li key={player.id} className="flex items-center justify-between p-3 bg-muted rounded-lg shadow">
                        <div className="flex items-center">
                          {player.avatar.startsWith('/') ? (
                            <Image
                              src={player.avatar}
                              alt={`${player.name}'s avatar`}
                              width={40}
                              height={40}
                              className="mr-3 rounded-sm object-contain"
                              style={{ width: '40px', height: '40px' }}
                            />
                          ) : (
                            <span className="text-3xl mr-3">{player.avatar}</span>
                          )}
                          <span className="text-xl font-medium text-foreground">{player.name}</span>
                        </div>
                        {gameForSetupRender.gamePhase === 'lobby' && (
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
                                {isProcessingAction && player.id === thisPlayerIdRef.current ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : (player.isReady ? <ThumbsUp className="mr-1 h-3 w-3"/> : null)}
                                {player.isReady ? "Ready!" : "Tap when Ready"}
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

                {showStartGameButton && (
                    <Button
                      onClick={handleStartGame}
                      variant="default"
                      size="lg"
                      className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90 text-xl font-bold py-6 shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out"
                      disabled={isProcessingAction}
                    >
                      {isProcessingAction ? (
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      ) : (
                        <Play className="mr-3 h-7 w-7" />
                      )}
                      🚀 Start Game Now!
                    </Button>
                )}
                {gameForSetupRender.gamePhase === 'lobby' && lobbyMessage && (
                    <p className="text-sm text-center mt-4 text-yellow-600 dark:text-yellow-400 font-semibold">{lobbyMessage}</p>
                )}
              </CardContent>
            </Card>
          )}
          {showGameInProgressMessage && gameForSetupRender.currentJudgeId && !thisPlayerObject && (
             <Scoreboard players={gameForSetupRender.players} currentJudgeId={gameForSetupRender.currentJudgeId} />
          )}
        </div>

        <div className="mt-12 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-accent text-accent-foreground hover:bg-accent/80">
                <HelpCircle className="mr-2 h-5 w-5" /> How to Play
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <HowToPlayModalContent />
            </DialogContent>
          </Dialog>
          <Button
            onClick={handleResetGame}
            variant="destructive"
            className="hover:bg-destructive/80"
            disabled={isProcessingAction || isLoading }
          >
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
          </Button>
        </div>

          <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
        </footer>
      </div>
    );
  }

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
        style={{ height: 'auto' }}
      />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">
        Make It Terrible
      </h1>
      <p className="text-2xl text-muted-foreground mb-10">
        The game of awful choices and hilarious outcomes!
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Button
          onClick={() => { showGlobalLoader(); router.push('/?step=setup');}}
          variant="default"
          size="lg"
          className="bg-accent text-accent-foreground hover:bg-accent/90 text-2xl px-10 py-8 font-bold shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out"
        >
          Join the Mayhem <ArrowRight className="ml-3 h-7 w-7" />
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" className="text-lg px-8 py-7">
              <HelpCircle className="mr-2 h-6 w-6" /> How to Play
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <HowToPlayModalContent />
          </DialogContent>
        </Dialog>
      </div>
      <footer className="absolute bottom-8 text-center text-sm text-muted-foreground w-full">
        <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
      </footer>
    </div>
  );
}
    

    