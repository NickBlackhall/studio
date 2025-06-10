
"use client";

import Image from 'next/image';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { Users, ArrowRight, RefreshCw, Loader2, CheckSquare, XSquare, HelpCircle, Info, Lock, Crown } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';
import ReadyToggle from '@/components/game/ReadyToggle';
import { motion } from 'framer-motion';
import Link from 'next/link';
import CustomCardFrame from '@/components/ui/CustomCardFrame';


export const dynamic = 'force-dynamic';

// --- CONFIGURATION FLAG ---
// Set to false to prevent the logo on the setup screen from navigating to the welcome screen (e.g., for beta testing)
const ENABLE_SETUP_LOGO_NAVIGATION = true;
// --- END CONFIGURATION FLAG ---

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [internalGame, setInternalGame] = useState<GameClientState | null>(null);
  const gameRef = useRef<GameClientState | null>(null);

  const [internalThisPlayerId, setInternalThisPlayerId] = useState<string | null>(null);
  const thisPlayerIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true); // Local loading state for initial page elements
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const { showGlobalLoader, hideGlobalLoader } = useLoading();

  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';

  const parseReadyPlayerOrderStr = useCallback((gameState: GameClientState | null): string[] => {
    if (!gameState || typeof gameState.ready_player_order_str !== 'string') {
      return [];
    }
    try {
      const parsed = JSON.parse(gameState.ready_player_order_str);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Client (parseReadyPlayerOrderStr): Failed to parse ready_player_order_str", e, gameState.ready_player_order_str);
      return [];
    }
  }, []);

  const setGame = useCallback((newGameState: GameClientState | null) => {
    gameRef.current = newGameState;
    if (isMountedRef.current) {
      if (newGameState && typeof newGameState.ready_player_order_str === 'string') {
        const rpoArray = parseReadyPlayerOrderStr(newGameState);
        setInternalGame({ ...newGameState, ready_player_order: rpoArray });
      } else if (newGameState) {
        setInternalGame({ ...newGameState, ready_player_order: newGameState.ready_player_order || [] });
      } else {
        setInternalGame(null);
      }
    }
  }, [parseReadyPlayerOrderStr]);

  const setThisPlayerId = useCallback((newPlayerId: string | null) => {
    thisPlayerIdRef.current = newPlayerId;
    if (isMountedRef.current) {
      setInternalThisPlayerId(newPlayerId);
    }
  }, []);

  const fetchGameData = useCallback(async (origin: string = "unknown", gameIdToFetch?: string) => {
    const isInitialPageLoad = origin.includes("initial mount");
    const isStepChange = origin.includes("step changed to");

    if (isInitialPageLoad && isMountedRef.current) {
       // Local loading for initial elements, global handled by caller for step changes
    }

    try {
      let fetchedGameState = await getGame(gameIdToFetch);

      if (fetchedGameState) {
        if (typeof fetchedGameState.ready_player_order_str === 'string') {
            fetchedGameState.ready_player_order = parseReadyPlayerOrderStr(fetchedGameState);
        } else if (typeof fetchedGameState.ready_player_order === 'undefined' || !Array.isArray(fetchedGameState.ready_player_order)) {
            console.warn(`Client (fetchGameData): RPO was undefined or not an array from getGame(), defaulting to []. Game ID: ${fetchedGameState.gameId}, Origin: ${origin}`);
            fetchedGameState.ready_player_order = [];
        }
      } else {
        console.warn(`Client (fetchGameData): fetchedGameState was null. (Origin: ${origin})`);
      }

      if (!isMountedRef.current) {
        return;
      }

      setGame(fetchedGameState);

      if (fetchedGameState && fetchedGameState.gameId) {
        const localStorageKey = `thisPlayerId_game_${fetchedGameState.gameId}`;

        if (fetchedGameState.players.length === 0 && (origin.includes("reset") || origin.includes("handleResetGame"))) {
          localStorage.removeItem(localStorageKey);
          setThisPlayerId(null);
        } else {
          const playerIdFromStorage = localStorage.getItem(localStorageKey);
          if (playerIdFromStorage) {
            const playerInGame = fetchedGameState.players.find(p => p.id === playerIdFromStorage);
            if (playerInGame) {
              setThisPlayerId(playerIdFromStorage);
            } else {
              localStorage.removeItem(localStorageKey);
              setThisPlayerId(null);
            }
          } else {
            setThisPlayerId(null);
          }
        }
      } else {
        setThisPlayerId(null);
        if ((isInitialPageLoad || isStepChange) && isMountedRef.current) {
            setGame(null);
            toast({ title: "Game Session Error", description: "Could not initialize or find the game session. Please try refreshing or resetting.", variant: "destructive"});
        }
      }
    } catch (error: any) {
      console.error(`Client (fetchGameData): Failed to fetch game state (from ${origin}, gameIdToFetch: ${gameIdToFetch || 'N/A'}):`, error);
      if (isMountedRef.current) {
        if (gameIdToFetch && !isInitialPageLoad && !isStepChange) { // Only toast for non-critical background fetches
            toast({ title: "Game Update Failed", description: `Could not refresh game ${gameIdToFetch}: ${error.message}. State may be temporarily stale.`, variant: "default"});
        } else if (isInitialPageLoad || isStepChange) { // Critical fetches
            setGame(null);
            setThisPlayerId(null);
            toast({ title: "Load Error", description: `Could not fetch game state: ${error.message || String(error)}`, variant: "destructive"});
        }
      }
    } finally {
      if (isMountedRef.current) {
        if (isInitialPageLoad) setIsLoading(false); // Local loading for page content
        if (isInitialPageLoad || isStepChange || origin.includes("reset") || origin.includes("handleResetGame") || origin.includes("step changed to")) {
          hideGlobalLoader(); // Ensure global loader is hidden after primary fetches
        }
      }
    }
  }, [toast, setGame, setThisPlayerId, hideGlobalLoader, parseReadyPlayerOrderStr]);


  // Effect for initial mount
  useEffect(() => {
    isMountedRef.current = true;
    console.log("WelcomePage: Initial mount. Showing global loader.");
    showGlobalLoader();
    fetchGameData(`initial mount (currentStep: ${currentStep})`);

    return () => {
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on initial mount

  // Effect for handling changes to currentStepQueryParam (e.g., after router.push)
   useEffect(() => {
    if (isMountedRef.current) {
      const newStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';
      const previousStepRef = gameRef.current ? (currentStepQueryParam === 'setup' ? 'welcome' : 'setup') : 'initial';

      if (newStep !== previousStepRef || !internalGame) {
        console.log(`WelcomePage: currentStepQueryParam changed from '${previousStepRef}' to '${newStep}' or game data missing. Fetching data.`);
        showGlobalLoader();
        fetchGameData(`step changed to: ${newStep}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepQueryParam]);


  useEffect(() => {
    let backgroundTimerId: NodeJS.Timeout | undefined;
    if (typeof window !== 'undefined') {
      if (currentStep === 'setup') {
        document.body.classList.add('setup-view-active');
        document.body.classList.remove('welcome-background-visible');
      } else { // Welcome step
        document.body.classList.remove('setup-view-active');
        backgroundTimerId = setTimeout(() => {
          if (isMountedRef.current) {
            document.body.classList.add('welcome-background-visible');
          }
        }, 50);
      }
    }

    return () => {
      if (backgroundTimerId) {
        clearTimeout(backgroundTimerId);
      }
      if (typeof window !== 'undefined') {
        document.body.classList.remove('setup-view-active');
        document.body.classList.remove('welcome-background-visible');
      }
    };
  }, [currentStep]);


  useEffect(() => {
    const gameForNavCheck = internalGame;
    const localThisPlayerId = internalThisPlayerId;

    if (isMountedRef.current && gameForNavCheck && gameForNavCheck.gameId &&
        gameForNavCheck.gamePhase !== 'lobby' &&
        ACTIVE_PLAYING_PHASES.includes(gameForNavCheck.gamePhase as GamePhaseClientState) &&
        currentStep === 'setup' &&
        localThisPlayerId
      ) {
      router.push('/game');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalGame?.gamePhase, internalGame?.gameId, internalThisPlayerId, currentStep, router]);


  useEffect(() => {
    const currentGameId = internalGame?.gameId;
    const currentThisPlayerId = internalThisPlayerId;

    if (!currentGameId || isLoading) {
      return () => {};
    }

    const uniqueChannelSuffix = currentThisPlayerId || Date.now();

    const handlePlayersUpdate = async (payload: any) => {
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) {
        await fetchGameData(`players-lobby-${latestGameId}-${uniqueChannelSuffix} player change`, latestGameId);
      }
    };

    const handleGameTableUpdate = async (payload: any) => {
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) {
        await fetchGameData(`games-lobby-${latestGameId}-${uniqueChannelSuffix} game change`, latestGameId);
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
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Client (Realtime): Subscription error (${playersChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        } else if (status === 'CLOSED') {
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
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Client (Realtime): Subscription error (${gameChannelName}): "${status}"`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        } else if (status === 'CLOSED') {
        } else if (err) {
           console.error(`Client (Realtime): Unexpected error or status on ${gameChannelName} subscription (status: ${status}):`, err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error object');
        }
      });

    return () => {
      const gameIdForCleanup = gameRef.current?.gameId;
      if (gameIdForCleanup) {
        supabase.removeChannel(playersChannel).catch(err => console.error("Client (Realtime cleanup): Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Client (Realtime cleanup): Error removing game channel on WelcomePage:", err));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalGame?.gameId, internalThisPlayerId, isLoading, fetchGameData]);

  const thisPlayerObject = useMemo(() => {
    return internalThisPlayerId && internalGame?.players ? internalGame.players.find(p => p.id === internalThisPlayerId) : null;
  }, [internalThisPlayerId, internalGame?.players]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGame || !internalGame.players) return [];
    if (!thisPlayerObject) return internalGame.players;

    const otherPlayers = internalGame.players.filter(p => p.id !== thisPlayerObject.id);
    return [thisPlayerObject, ...otherPlayers];
  }, [internalGame, thisPlayerObject]);

  const hostPlayerId = useMemo(() => {
    if (!internalGame || !Array.isArray(internalGame.ready_player_order)) {
      return null;
    }
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

    startPlayerActionTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
        } else if (isMountedRef.current) {
           if (newPlayer === null && internalGame?.gamePhase !== 'lobby') {
            toast({ title: "Game in Progress", description: "Cannot join now. Please wait for the next game.", variant: "destructive"});
          } else if (newPlayer === null) {
            toast({ title: "Join Error", description: "Could not add player to the game.", variant: "destructive"});
          }
        }
      } catch (error: any) {
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
    showGlobalLoader();
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (!isMountedRef.current) {
            return;
        }
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          return;
        }
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

    startPlayerActionTransition(async () => {
      try {
        await togglePlayerReadyStatus(player.id, currentGameId);
      } catch (error: any) {
        if (isMountedRef.current) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            showGlobalLoader();
            return;
          }
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
                      return;
                  }
                  toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
                  hideGlobalLoader();
              }
            }
        });
    }
  };


  if (isLoading && !internalGame ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        {/* Optional: A very minimal loader if desired before game state is known */}
      </div>
    );
  }

  if (!internalGame || !internalGame.gameId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        {/* Fallback for critical error if game couldn't be fetched/initialized */}
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => { showGlobalLoader(); window.location.reload(); }} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const gameIsActuallyActive = ACTIVE_PLAYING_PHASES.includes(internalGame.gamePhase as GamePhaseClientState);
  const isLobbyPhaseActive = internalGame.gamePhase === 'lobby';
  const isSpectatorView = gameIsActuallyActive && !thisPlayerObject;
  const isActivePlayerOnLobbyPage = gameIsActuallyActive && thisPlayerObject;

  const SetupLogo = () => (
    <Image src="/new-logo.png" alt="Make It Terrible Logo" width={100} height={100} data-ai-hint="game logo" priority />
  );

  const ClickableSetupLogo = () => (
    <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer mb-8 block mx-auto">
      <SetupLogo />
    </button>
  );

  const StaticSetupLogo = () => (
    <div className="mb-8 block mx-auto">
      <SetupLogo />
    </div>
  );


  if (currentStep === 'setup') {
    if (isSpectatorView) {
      return (
        <div className="w-full max-w-xl mx-auto space-y-6 text-center py-12">
          {ENABLE_SETUP_LOGO_NAVIGATION ? <ClickableSetupLogo /> : <StaticSetupLogo />}
          <Card className="my-4 shadow-md border-2 border-destructive rounded-lg">
            <CardHeader className="p-4">
              <Lock className="h-8 w-8 mx-auto text-destructive mb-2" />
              <CardTitle className="text-xl font-semibold">Game in Progress!</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm">
                <p>Sorry, you&apos;ll have to wait until the next game to join. But you can still watch.</p>
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
           {ENABLE_SETUP_LOGO_NAVIGATION ? <ClickableSetupLogo /> : <StaticSetupLogo />}
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

      const showStartGameButton =
        internalThisPlayerId !== null &&
        internalThisPlayerId === hostPlayerId &&
        enoughPlayers &&
        allPlayersReady;

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
        const hostNameForMessage = hostPlayerForMsg?.name || ( (internalGame.ready_player_order?.length || 0) > 0 ? 'first player to ready up' : 'the host');
        lobbyMessage = `Game starts once all you terrible people are ready. So hurry up!`;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
          <header className="mb-12 text-center">
            {ENABLE_SETUP_LOGO_NAVIGATION ? (
              <button onClick={() => {showGlobalLoader(); router.push('/?step=welcome')}} className="cursor-pointer">
                <Image src="/new-logo.png" alt="Make It Terrible Logo" width={100} height={100} className="mx-auto mb-4" data-ai-hint="game logo" priority />
              </button>
            ) : (
              <div className="mx-auto mb-4">
                <Image src="/new-logo.png" alt="Make It Terrible Logo" width={100} height={100} data-ai-hint="game logo" priority />
              </div>
            )}
            <h1 className="text-6xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
            {isLobbyPhaseActive && (
              <>
                {thisPlayerObject && <p className="text-xl text-muted-foreground mt-2">Welcome, {thisPlayerObject.name}! Toggle your ready status below.</p>}
                {showPlayerSetupForm && <p className="text-xl text-muted-foreground mt-2">Enter your details to join, then toggle your ready status!</p>}
              </>
            )}
          </header>

          <div className={cn("grid gap-8 w-full max-w-4xl", showPlayerSetupForm ? "md:grid-cols-2" : "md:grid-cols-1")}>
            {showPlayerSetupForm && (
              <Card className="shadow-2xl border-2 border-transparent rounded-xl overflow-hidden bg-primary text-primary-foreground">
                <CardHeader className="bg-primary text-primary-foreground p-6">
                  <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
                  <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your avatar.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 bg-primary">
                  <PlayerSetupForm addPlayer={handleAddPlayer} />
                </CardContent>
              </Card>
            )}

             <div className={cn(
                "relative shadow-2xl rounded-xl overflow-hidden flex flex-col",
                !showPlayerSetupForm && "md:col-span-1",
                "bg-transparent"
              )}>
              <CustomCardFrame
                texturePath="/textures/red-halftone-texture.png"
                className="absolute inset-0 w-full h-full -z-10"
              />
              <div className={cn(
                  "flex flex-col flex-1 z-10 p-6 text-white",
                  !showPlayerSetupForm && ""
                )}>
                <div className="mb-4">
                  <h3 className="text-3xl font-bold flex items-center text-shadow-sm">
                    <Users className="mr-3 h-8 w-8" />
                    Players ({internalGame.players.length})
                  </h3>
                  <p className="text-white/90 text-base mt-1 text-shadow-xs">
                    {lobbyMessage}
                  </p>
                </div>

                <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent pr-2 -mr-2 pb-3">
                  <ul className="space-y-3 px-3">
                    {sortedPlayersForDisplay.length > 0 ? (
                      sortedPlayersForDisplay.map((player: PlayerClientState) => (
                        <li
                          key={player.id}
                          className="flex items-center justify-between p-3 bg-[#e3bb71] border-2 border-black text-black"
                        >
                          <div className="flex items-center">
                            {player.avatar.startsWith('/') ? (
                              <Image src={player.avatar} alt={`${player.name}'s avatar`} width={40} height={40} className="mr-3 rounded-sm object-contain" style={{ width: '40px', height: '40px' }} />
                            ) : (
                              <span className="text-3xl mr-3">{player.avatar}</span>
                            )}
                            <span className="text-xl font-medium">{player.name}</span>
                            {player.id === hostPlayerId && (
                              <Crown className="ml-2 h-5 w-5 text-yellow-600" title="Host" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {player.id === internalThisPlayerId ? (
                              <ReadyToggle
                                isReady={player.isReady}
                                onToggle={() => handleToggleReady(player)}
                                disabled={isProcessingAction}
                              />
                            ) : (
                              player.isReady ?
                                <CheckSquare className="h-6 w-6 text-green-700" title="Ready" /> :
                                <XSquare className="h-6 w-6 text-red-700" title="Not Ready" />
                            )}
                          </div>
                        </li>
                      ))
                    ) : (
                      <p className="text-white/80 text-center py-4">No players yet. Be the first to cause some trouble!</p>
                    )}
                  </ul>
                </div>

                {showStartGameButton && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleStartGame}
                      disabled={isProcessingAction || isLoading}
                      className={cn(
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
                        (isProcessingAction || isLoading) ? "opacity-60 cursor-not-allowed" : "transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95"
                      )}
                      aria-label="Start Game Now!"
                    >
                      { (isProcessingAction || isLoading) ? (
                        <div className="flex items-center justify-center w-[280px] h-[70px] bg-muted rounded-md">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : (
                        <Image
                          src="/ui/start-game-button.png"
                          alt="Start Game Now!"
                          width={280}
                          height={70}
                          priority
                          data-ai-hint="start game"
                        />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Image
                  src="/ui/how-to-play-button.png"
                  alt="How to Play"
                  width={180}
                  height={50}
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  data-ai-hint="play instructions"
                />
              </DialogTrigger>
              <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
            </Dialog>
            <Button onClick={handleResetGame} variant="destructive" className="hover:bg-destructive/80" disabled={isProcessingAction || isLoading }>
              { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
            </Button>
          </div>
        </div>
      );
    }
  }

  // Welcome Screen: currentStep !== 'setup'
  return (
    <div className="fixed inset-0 z-10 flex flex-col h-full w-full items-center justify-center">
      <motion.a
        onClick={(e) => { e.preventDefault(); showGlobalLoader(); router.push('/?step=setup');}}
        href="/?step=setup"
        className="block mx-auto cursor-pointer"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/ui/enter-the-chaos-button.png"
          alt="Enter the Chaos"
          width={224}
          height={84}
          className=""
          priority
          data-ai-hint="chaos button"
        />
      </motion.a>
    </div>
  );
}

