
"use client";

import Image from 'next/image';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { ArrowRight, RefreshCw, Loader2, CheckSquare, XSquare, HelpCircle, Info, Lock, Crown } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link'; 
import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useLoading } from '@/contexts/LoadingContext';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';
import ReadyToggle from '@/components/game/ReadyToggle';
import { motion } from 'framer-motion';
import CustomCardFrame from '@/components/ui/CustomCardFrame';


export const dynamic = 'force-dynamic';

const ENABLE_SETUP_LOGO_NAVIGATION = true;
const MotionLink = motion(Link);

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [internalGame, setInternalGame] = useState<GameClientState | null>(null);
  const gameRef = useRef<GameClientState | null>(null);

  const [internalThisPlayerId, setInternalThisPlayerId] = useState<string | null>(null);
  const thisPlayerIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true); // Page's local loading state
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

  const fetchGameData = useCallback(async (fetchOrigin: string, gameIdToFetch?: string) => {
    console.log(`WelcomePage: fetchGameData called from ${fetchOrigin}. gameIdToFetch: ${gameIdToFetch}`);
    // setIsLoading(true); // Local loading state managed by the caller useEffect

    let fetchedGameState = await getGame(gameIdToFetch);

    if (fetchedGameState) {
      if (typeof fetchedGameState.ready_player_order_str === 'string') {
          fetchedGameState.ready_player_order = parseReadyPlayerOrderStr(fetchedGameState);
      } else if (typeof fetchedGameState.ready_player_order === 'undefined' || !Array.isArray(fetchedGameState.ready_player_order)) {
          console.warn(`Client (fetchGameData): RPO was undefined or not an array from getGame(), defaulting to []. Game ID: ${fetchedGameState.gameId}, Origin: ${fetchOrigin}`);
          fetchedGameState.ready_player_order = [];
      }
    }

    if (!isMountedRef.current) {
      console.log("WelcomePage: fetchGameData - unmounted during fetch. Aborting state update.");
      return;
    }

    setGame(fetchedGameState);

    if (fetchedGameState && fetchedGameState.gameId) {
      const localStorageKey = `thisPlayerId_game_${fetchedGameState.gameId}`;
      if (fetchedGameState.players.length === 0 && (fetchOrigin.includes("reset") || fetchOrigin.includes("handleResetGame"))) {
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
       if (isMountedRef.current && (fetchOrigin.includes("initial mount") || fetchOrigin.includes("step changed to") || fetchOrigin.includes("effect for step:"))) {
          setGame(null);
      }
    }
  }, [setGame, setThisPlayerId, parseReadyPlayerOrderStr]);


  useEffect(() => {
    isMountedRef.current = true;
    let isActive = true;

    const loadDataForCurrentStep = async () => {
      if (!isActive) return;

      console.log(`WelcomePage: Current step is '${currentStep}'. Starting data load sequence.`);
      if (isMountedRef.current) {
        showGlobalLoader();
        setIsLoading(true); // Set local loading for this page's specific rendering
      }
      
      try {
        await fetchGameData(`effect for step: ${currentStep}`);
      } catch (error: any) {
        console.error(`WelcomePage: Error in loadDataForCurrentStep for step ${currentStep}:`, error);
        if (isActive && isMountedRef.current) {
          toast({ title: "Data Load Error", description: `Could not load data. ${error.message || ''}`, variant: "destructive" });
        }
      } finally {
        if (isActive && isMountedRef.current) {
          console.log(`WelcomePage: Data load sequence for step '${currentStep}' finished. Hiding global loader and local loader.`);
          hideGlobalLoader();
          setIsLoading(false); 
        }
      }
    };

    loadDataForCurrentStep();

    return () => {
      isActive = false;
      isMountedRef.current = false;
    };
  }, [currentStep, fetchGameData, showGlobalLoader, hideGlobalLoader, toast]);

  useEffect(() => {
      let backgroundTimerId: NodeJS.Timeout | undefined;
      if (typeof window !== 'undefined') {
        if (currentStep === 'setup') {
          document.body.classList.add('setup-view-active');
          document.body.classList.remove('welcome-background-visible');
        } else {
          document.body.classList.remove('setup-view-active');
          backgroundTimerId = setTimeout(() => {
            if (isMountedRef.current) {
              document.body.classList.add('welcome-background-visible');
            }
          }, 50);
        }
      }
      return () => {
        if (backgroundTimerId) clearTimeout(backgroundTimerId);
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
      console.log(`WelcomePage: Game active (phase ${gameForNavCheck.gamePhase}), player identified, on setup. Redirecting to /game.`);
      router.push('/game');
    }
  }, [internalGame, internalThisPlayerId, currentStep, router]);


  useEffect(() => {
    const currentGameId = internalGame?.gameId;
    if (!currentGameId || isLoading) return () => {}; // Added isLoading check

    const uniqueChannelSuffix = internalThisPlayerId || Date.now();

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${currentGameId}` }, handlePlayersUpdate)
      .subscribe((status, err) => {
        if (err) console.error(`Client (Realtime Players Sub Error - ${playersChannelName}):`, err);
      });

    const gameChannelName = `game-state-lobby-${currentGameId}-${uniqueChannelSuffix}`;
    const gameChannel = supabase
      .channel(gameChannelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${currentGameId}` }, handleGameTableUpdate)
      .subscribe((status, err) => {
        if (err) console.error(`Client (Realtime Game Sub Error - ${gameChannelName}):`, err);
      });

    return () => {
      if (gameRef.current?.gameId) {
        supabase.removeChannel(playersChannel).catch(err => console.error("Client (Realtime Cleanup Error - Players):", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Client (Realtime Cleanup Error - Game):", err));
      }
    };
  }, [internalGame?.gameId, internalThisPlayerId, isLoading, fetchGameData]);

  const thisPlayerObject = useMemo(() => {
    return internalThisPlayerId && internalGame?.players ? internalGame.players.find(p => p.id === internalThisPlayerId) : null;
  }, [internalThisPlayerId, internalGame?.players]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGame || !internalGame.players) return [];
    if (!thisPlayerObject) return internalGame.players.sort((a,b) => (a.joined_at || "").localeCompare(b.joined_at || ""));

    const otherPlayers = internalGame.players.filter(p => p.id !== thisPlayerObject.id).sort((a,b) => (a.joined_at || "").localeCompare(b.joined_at || ""));
    return [thisPlayerObject, ...otherPlayers];
  }, [internalGame, thisPlayerObject]);

  const hostPlayerId = useMemo(() => {
    if (!internalGame || !Array.isArray(internalGame.ready_player_order)) return null;
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
    const currentGameId = gameRef.current?.gameId;

    if (!name.trim() || !avatar) {
        toast({ title: "Missing Info", description: "Please enter your name and select an avatar.", variant: "destructive" });
        return;
    }
    if (!currentGameId) {
        toast({ title: "Error!", description: "Game session not found. Please refresh.", variant: "destructive"});
        if (isMountedRef.current) {
            showGlobalLoader();
            setIsLoading(true);
            try { await fetchGameData("handleAddPlayer_no_gameId"); }
            finally { if(isMountedRef.current) { hideGlobalLoader(); setIsLoading(false); } }
        }
        return;
    }

    startPlayerActionTransition(async () => {
      try {
        const newPlayer = await addPlayerAction(name, avatar);
        if (newPlayer && newPlayer.id && gameRef.current?.id && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${gameRef.current.id}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          // No explicit fetchGameData here, rely on subscription or parent effect if needed to refresh all players
          // Or, if immediate full refresh is desired:
          // showGlobalLoader(); setIsLoading(true);
          // try { await fetchGameData("handleAddPlayer_success", gameRef.current.id); }
          // finally { if(isMountedRef.current) { hideGlobalLoader(); setIsLoading(false); } }
        } else if (isMountedRef.current) {
           if (newPlayer === null && gameRef.current?.gamePhase !== 'lobby') {
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
    if (isMountedRef.current) {
      showGlobalLoader();
      setIsLoading(true);
    }
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
        // fetchGameData will be called by the subscription or redirect effect
        // if (isMountedRef.current) { // To immediately clear local state if preferred
        //    setThisPlayerId(null);
        //    localStorage.removeItem(`thisPlayerId_game_${gameRef.current?.id}`); // if gameRef.current.id exists
        //    await fetchGameData("handleResetGame_success");
        // }
      } catch (error: any) {
        if (!isMountedRef.current) return;
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          return;
        }
        toast({ title: "Reset Failed", description: `Could not reset game. ${error.message || String(error)}`, variant: "destructive"});
      } finally {
         if (!isMountedRef.current || (typeof (window as any).NEXT_REDIRECT_EXPECTED !== 'undefined' && (window as any).NEXT_REDIRECT_EXPECTED)) {
          // Don't hide loader if unmounted or if a redirect is expected (hypothetical flag)
        } else {
          hideGlobalLoader();
          setIsLoading(false);
        }
      }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    const currentGameId = gameRef.current?.gameId;
    const currentThisPlayerIdValue = thisPlayerIdRef.current;

    if (!currentGameId || !currentThisPlayerIdValue) {
        toast({ title: "Error", description: "Cannot change ready status. Game or player not identified.", variant: "destructive" });
        return;
    }
    if (player.id !== currentThisPlayerIdValue) {
      toast({ title: "Hey!", description: "You can only ready up yourself.", variant: "destructive" });
      return;
    }

    startPlayerActionTransition(async () => {
      try {
        const updatedGame = await togglePlayerReadyStatus(player.id, currentGameId);
        // Rely on subscription to update game state to avoid stale data or race conditions
        // if (updatedGame && isMountedRef.current) {
        //   setGame(updatedGame);
        // }
      } catch (error: any) {
        if (isMountedRef.current) {
          if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
            showGlobalLoader(); setIsLoading(true);
            return;
          }
          toast({ title: "Ready Status Error", description: error.message || String(error), variant: "destructive"});
        }
      }
    });
  };

  const handleStartGame = async () => {
    const gameToStart = gameRef.current;
    if (gameToStart?.gameId && gameToStart.gamePhase === 'lobby') {
        if (isMountedRef.current) {
          showGlobalLoader();
          setIsLoading(true);
        }
        startPlayerActionTransition(async () => {
            try {
                await startGameAction(gameToStart.gameId);
            } catch (error: any) {
              if (isMountedRef.current) {
                  if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
                      return;
                  }
                  toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
              }
            } finally {
               if (!isMountedRef.current || (typeof (window as any).NEXT_REDIRECT_EXPECTED !== 'undefined' && (window as any).NEXT_REDIRECT_EXPECTED)) {
                // Don't hide if unmounted or redirect expected
               } else {
                 hideGlobalLoader();
                 setIsLoading(false);
               }
            }
        });
    }
  };


  if (isLoading && (!internalGame || currentStep !== 'welcome')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        {/* Global loader active */}
      </div>
    );
  }
  
  if (currentStep === 'setup' && isLoading) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
         <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p>Loading setup details...</p>
      </div>
    );
  }
  
  if (currentStep === 'setup' && !internalGame && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <Image src="/new-logo.png" alt="Game Logo - Error" width={100} height={100} className="mb-6 opacity-70" data-ai-hint="game logo"/>
        <p className="text-xl text-destructive mt-4">An unexpected error occurred on the setup page. Please try refreshing.</p>
         <Button onClick={() => { showGlobalLoader(); setIsLoading(true); window.location.reload(); }} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }


  if (currentStep === 'welcome' && internalGame && internalGame.gameId && internalGame.gamePhase !== 'lobby' && ACTIVE_PLAYING_PHASES.includes(internalGame.gamePhase as GamePhaseClientState)) {
     return (
        <div className="fixed inset-0 z-10 flex flex-col h-full w-full items-center justify-center">
           <Image src="/new-logo.png" alt="Make It Terrible Logo" width={150} height={150} className="mb-8" data-ai-hint="game logo" priority />
          <p className="text-2xl font-semibold text-center mb-4 text-foreground">A game is in progress!</p>
          <div className="space-y-3">
            <Link href="/?step=setup" passHref>
                <Button
                    size="lg"
                    className="w-64 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {showGlobalLoader(); setIsLoading(true);}}
                >
                    Go to Lobby / Join
                </Button>
            </Link>
            {thisPlayerIdRef.current && internalGame.players.find(p=>p.id === thisPlayerIdRef.current) && (
                 <Link href="/game" passHref>
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-64"
                        onClick={() => {showGlobalLoader(); setIsLoading(true);}}
                    >
                        Rejoin Active Game
                    </Button>
                </Link>
            )}
          </div>
        </div>
    );
  }


  const gameIsActuallyActive = internalGame && ACTIVE_PLAYING_PHASES.includes(internalGame.gamePhase as GamePhaseClientState);
  const isLobbyPhaseActive = internalGame?.gamePhase === 'lobby';
  const isSpectatorView = gameIsActuallyActive && !thisPlayerObject;
  const isActivePlayerOnLobbyPage = gameIsActuallyActive && thisPlayerObject;

  const SetupLogo = () => (
    <Image src="/new-logo.png" alt="Make It Terrible Logo" width={100} height={100} data-ai-hint="game logo" priority />
  );

  const ClickableSetupLogo = () => (
    <Link href="/?step=welcome" passHref>
        <button className="cursor-pointer mb-8 block mx-auto" onClick={() => {showGlobalLoader(); setIsLoading(true);}}>
            <SetupLogo />
        </button>
    </Link>
  );

  const StaticSetupLogo = () => (
    <div className="mb-8 block mx-auto">
      <SetupLogo />
    </div>
  );


  if (currentStep === 'setup') {
    if (!internalGame || !internalGame.gameId) { 
        return <div className="text-center py-10">Critical error: Game data missing for setup. Please refresh.</div>;
    }

    if (internalGame.gamePhase === 'game_over' || internalGame.gamePhase === 'winner_announcement') {
      return (
        <div className="w-full max-w-xl mx-auto space-y-6 text-center py-12">
          {ENABLE_SETUP_LOGO_NAVIGATION ? <ClickableSetupLogo /> : <StaticSetupLogo />}
          <Card className="my-4 shadow-md border-2 border-primary/30 rounded-lg bg-card">
            <CardHeader className="p-4">
              <Info className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-xl font-semibold text-card-foreground">Game Has Concluded</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                <p>The previous game session has finished.</p>
                <p>Ready for another round of terrible fun?</p>
            </CardContent>
          </Card>
          <Button onClick={handleResetGame} variant="default" className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isProcessingAction || isLoading}>
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Start New Game
          </Button>
        </div>
      );
    }

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
                onClick={() => { showGlobalLoader(); setIsLoading(true); router.push('/game'); }}
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
        lobbyMessage = `Game starts once all you terrible people are ready. So hurry up!`;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
          <header className="mb-12 text-center">
            {ENABLE_SETUP_LOGO_NAVIGATION ? (
              <Link href="/?step=welcome" passHref>
                 <button className="cursor-pointer" onClick={() => {showGlobalLoader(); setIsLoading(true);}}>
                    <Image src="/new-logo.png" alt="Make It Terrible Logo" width={100} height={100} className="mx-auto mb-4" data-ai-hint="game logo" priority />
                </button>
              </Link>
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
                "relative shadow-2xl rounded-xl overflow-hidden flex flex-col max-w-md mx-auto w-full",
                !showPlayerSetupForm && "md:col-span-1" ,
                "bg-transparent"
              )}>
              {/* <CustomCardFrame
                texturePath="/textures/red-halftone-texture.png"
                className="absolute inset-0 w-full h-full -z-10"
              /> */}
              {/* console.warn("CustomCardFrame is temporarily commented out for debugging in src/app/page.tsx") */}
              <div className={cn(
                  "flex flex-col flex-1 z-10 p-6 bg-muted/80 rounded-xl", // Added a fallback background
                  !showPlayerSetupForm && ""
                )}>
                <div className="mt-6">
                  <h3 className="text-4xl font-bold text-foreground text-center">
                    PLAYERS: <span className="text-accent">{internalGame.players.length}</span>
                  </h3>
                </div>
                <div className="mb-4">
                  <p className="text-foreground text-lg font-semibold mt-2 text-center">
                    {lobbyMessage}
                  </p>
                </div>

                <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-foreground/30 scrollbar-track-transparent pr-2 -mr-2 pb-3">
                  <ul className="space-y-3 px-3">
                    {sortedPlayersForDisplay.length > 0 ? (
                      sortedPlayersForDisplay.map((player: PlayerClientState) => (
                        <li
                          key={player.id}
                          className="flex items-center justify-between p-3 bg-card border-2 border-border text-card-foreground rounded-md"
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
                      <p className="text-muted-foreground text-center py-4">No players yet. Be the first to cause some trouble!</p>
                    )}
                  </ul>
                </div>

                {showStartGameButton && (
                  <div className="mt-6 flex justify-center pb-4">
                    <motion.button
                      onClick={handleStartGame}
                      disabled={isProcessingAction || isLoading}
                      className={cn(
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
                        (isProcessingAction || isLoading) ? "opacity-60 cursor-not-allowed" : "transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95"
                      )}
                      animate={{ scale: [1, 0.85, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      aria-label="Start Game Now!"
                    >
                      { (isProcessingAction || isLoading) ? (
                        <div className="flex items-center justify-center w-[224px] h-[56px] bg-muted rounded-md">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : (
                        <Image
                          src="/ui/start-game-button.png"
                          alt="Start Game Now!"
                          width={224}
                          height={56}
                          priority
                          data-ai-hint="start game"
                        />
                      )}
                    </motion.button>
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
    return (
        <div className="w-full max-w-xl mx-auto space-y-6 text-center py-12">
          {ENABLE_SETUP_LOGO_NAVIGATION ? <ClickableSetupLogo /> : <StaticSetupLogo />}
          <Card className="my-4 shadow-md border-2 border-primary/30 rounded-lg bg-card">
            <CardHeader className="p-4">
              <Info className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-xl font-semibold text-card-foreground">Setup Page: Game State ({internalGame?.gamePhase || 'Unknown'})</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                <p>The game is in an unexpected state for the setup page.</p>
                <p>You might want to reset the game or check if a game is in progress.</p>
            </CardContent>
          </Card>
          <Button onClick={handleResetGame} variant="default" className="mt-6 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isProcessingAction || isLoading}>
            { (isProcessingAction || isLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game
          </Button>
        </div>
      );
  }

  // Default: Welcome screen content (currentStep === 'welcome')
  return (
    <div className="fixed inset-0 z-10 flex flex-col h-full w-full items-center justify-center">
      <MotionLink
        href="/?step=setup"
        className="block mx-auto cursor-pointer"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: [1, 0.85, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        onClick={() => {showGlobalLoader(); setIsLoading(true);}}
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
      </MotionLink>
    </div>
  );
}
    
