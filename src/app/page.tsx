"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, CheckSquare, XSquare, HelpCircle, Info, Lock } from 'lucide-react';
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
import PWAGameLayout from '@/components/PWAGameLayout';
import type { Tables } from '@/lib/database.types';


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
    const isInitialOrResetCall = origin === "initial mount" || origin.includes("reset") || origin.includes("useEffect[] mount") || (!gameRef.current?.gameId && !gameIdToFetch);
    
    if (isInitialOrResetCall && isMountedRef.current) {
      // setIsLoading(true); 
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
      } else if (isMountedRef.current) {
         // Non-initial call completed
      }
    }
  }, [toast, setGame, setThisPlayerId, hideGlobalLoader, parseReadyPlayerOrderStr]);

  const handlePlayerAdded = useCallback(async (newPlayer: Tables<'players'>) => {
      const currentGameId = gameRef.current?.gameId;
      if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          await fetchGameData(`handlePlayerAdded after creating player ${newPlayer.id}`, currentGameId);
      }
  }, [fetchGameData, setThisPlayerId]);


  useEffect(() => {
    isMountedRef.current = true;
    showGlobalLoader(); 
    fetchGameData(`useEffect[] mount or currentStep change to: ${currentStep}`);
    
    return () => {
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showGlobalLoader();
      router.push('/game');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [internalGame, internalThisPlayerId, currentStep, router, showGlobalLoader]);


  useEffect(() => {
    const currentGameId = internalGame?.gameId;
    if (!currentGameId || isLoading) {
      return () => {};
    }

    const uniqueChannelSuffix = internalThisPlayerId || Date.now();

    const handleRealtimeUpdate = async (source: string, payload: any) => {
      const latestGameId = gameRef.current?.gameId;
      if (isMountedRef.current && latestGameId) {
        try {
          const fetchedGameState = await getGame(latestGameId);
          if (isMountedRef.current && fetchedGameState) {
             if (typeof fetchedGameState.ready_player_order_str === 'string') {
                fetchedGameState.ready_player_order = parseReadyPlayerOrderStr(fetchedGameState);
            } else if (typeof fetchedGameState.ready_player_order === 'undefined' || !Array.isArray(fetchedGameState.ready_player_order)) {
                console.warn(`Client (handleRealtimeUpdate from ${source}): RPO was undefined/not array, defaulting to [].`);
                fetchedGameState.ready_player_order = [];
            }
            setGame(fetchedGameState);
          }
        } catch (error) {
          console.error(`Error in handleRealtimeUpdate (from ${source}):`, error);
        }
      }
    };

    const playersChannelName = `players-lobby-${currentGameId}-${uniqueChannelSuffix}`;
    const playersChannel = supabase
      .channel(playersChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${currentGameId}` }, (payload) => handleRealtimeUpdate('players', payload))
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error(`Client (Realtime) - playersChannel error:`, { status, err: err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error' });
        }
      });

    const gameChannelName = `game-state-lobby-${currentGameId}-${uniqueChannelSuffix}`;
    const gameChannel = supabase
      .channel(gameChannelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${currentGameId}` }, (payload) => handleRealtimeUpdate('games', payload))
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.error(`Client (Realtime) - gameChannel error:`, { status, err: err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : 'undefined error' });
        }
      });
      
    return () => {
      const gameIdForCleanup = gameRef.current?.gameId; 
      if (gameIdForCleanup) {
        supabase.removeChannel(playersChannel).catch(err => console.error("Client (Realtime cleanup): Error removing players channel on WelcomePage:", err));
        supabase.removeChannel(gameChannel).catch(err => console.error("Client (Realtime cleanup): Error removing game channel on WelcomePage:", err));
      }
    };
  }, [internalGame?.gameId, internalThisPlayerId, currentStep, isLoading, setGame, parseReadyPlayerOrderStr]); 

  const thisPlayerObject = useMemo(() => {
    return internalThisPlayerId && internalGame?.players ? internalGame.players.find(p => p.id === internalThisPlayerId) : null;
  }, [internalThisPlayerId, internalGame?.players]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGame || !internalGame.players) return [];
    if (!thisPlayerObject) return internalGame.players; 
    
    const otherPlayers = internalGame.players.filter(p => p.id !== thisPlayerObject.id);
    return [thisPlayerObject, ...otherPlayers];
  }, [internalGame, thisPlayerObject]);

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
        let updatedGameState = await togglePlayerReadyStatus(player.id, currentGameId);
        if (isMountedRef.current) {
          if (updatedGameState) {
            if (typeof updatedGameState.ready_player_order_str === 'string') {
              updatedGameState.ready_player_order = parseReadyPlayerOrderStr(updatedGameState);
            } else if (typeof updatedGameState.ready_player_order === 'undefined' || !Array.isArray(updatedGameState.ready_player_order)) {
              console.warn(`Client (handleToggleReady): RPO undefined or not an array from togglePlayerReadyStatus, defaulting to []. Game ID: ${currentGameId}`);
              updatedGameState.ready_player_order = [];
            }
            setGame(updatedGameState); 
          } else {
            await fetchGameData(`handleToggleReady_null_fallback_game_${currentGameId}`, currentGameId);
          }
        }
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
        {/* Global loader is active */}
      </div>
    );
  }
  
  if (!internalGame || !internalGame.gameId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => { showGlobalLoader(); window.location.reload(); }} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  // These derived consts can be defined after early returns if they use internalGame which is now guaranteed to be non-null
  const gameIsActuallyActive = ACTIVE_PLAYING_PHASES.includes(internalGame.gamePhase as GamePhaseClientState);
  const isLobbyPhaseActive = internalGame.gamePhase === 'lobby';
  const isSpectatorView = gameIsActuallyActive && !thisPlayerObject; 
  const isActivePlayerOnLobbyPage = gameIsActuallyActive && thisPlayerObject; 

  if (currentStep === 'welcome') {
    return (
      <div className="relative flex-grow flex flex-col bg-black">
        <Image
          src="/backgrounds/mobile-background.jpg"
          alt="Make It Terrible game poster background"
          fill
          className="object-contain object-top"
          priority
          data-ai-hint="game poster"
        />
        <div className="relative z-10 flex flex-grow items-center justify-center">
          <button
            onClick={() => {
              showGlobalLoader();
              router.push('/?step=setup');
            }}
            className="group animate-slow-scale-pulse"
          >
            <Image
              src="/ui/enter-the-chaos-button.png"
              alt="Enter the Chaos"
              width={252}
              height={95}
              className="object-contain drop-shadow-xl"
              data-ai-hint="chaos button"
              priority
            />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'setup') {
    if (isLobbyPhaseActive && !thisPlayerObject) {
      return <PWAGameLayout gameId={internalGame.gameId} onPlayerAdded={handlePlayerAdded} />;
    }

    // For Spectator or Lobby view, use the centered, constrained layout
    const mainContent = (
      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-4">
        {isSpectatorView ? (
          <div className="w-full space-y-6 text-center">
            
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
        ) : isActivePlayerOnLobbyPage ? (
          <div className="w-full">
            
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
        ) : isLobbyPhaseActive && thisPlayerObject ? (
          (() => {
            const hostPlayerId = internalGame.ready_player_order.length > 0 ? internalGame.ready_player_order[0] : null;
            const enoughPlayers = internalGame.players.length >= MIN_PLAYERS_TO_START;
            const allPlayersReady = enoughPlayers && internalGame.players.every(p => p.isReady);
            const showStartGameButton = internalThisPlayerId === hostPlayerId && enoughPlayers && allPlayersReady;
            let lobbyMessage = "";
            if (!enoughPlayers) {
              lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players. Waiting for ${MIN_PLAYERS_TO_START - (internalGame.players?.length || 0)} more...`;
            } else if (!allPlayersReady) {
              const unreadyCount = internalGame.players.filter(p => !p.isReady).length;
              lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to ready up.`;
            } else if (showStartGameButton) {
              lobbyMessage = "All players are ready! Time to start the mayhem!";
            } else {
              const hostPlayerForMsg = hostPlayerId && internalGame.players.find(p => p.id === hostPlayerId);
              const hostNameForMessage = hostPlayerForMsg?.name || 'The host';
              lobbyMessage = `Waiting for ${hostNameForMessage} to start the game.`;
            }
            return (
              <div className="w-full">
                <div className="relative w-full max-w-lg mx-auto">
                  <Image
                    src="/backgrounds/lobby-card.png"
                    alt="Lobby card background"
                    width={500}
                    height={700}
                    className="w-full h-auto"
                    data-ai-hint="lobby card parchment"
                  />
                  <div className="absolute top-[23%] left-[10%] right-[10%] h-[62%] flex flex-col justify-between">
                    <div className="flex-grow overflow-y-auto space-y-2">
                        {sortedPlayersForDisplay.map((player) => (
                        <div
                            key={player.id}
                            className={cn(
                            "flex items-center justify-between p-3"
                            )}
                        >
                            <div className="flex items-center min-w-0">
                            {player.avatar.startsWith('/') ? (
                                <Image
                                src={player.avatar}
                                alt={`${player.name}'s avatar`}
                                width={56}
                                height={56}
                                className="mr-3 rounded-sm object-cover flex-shrink-0"
                                data-ai-hint="player avatar"
                                />
                            ) : (
                                <span className="text-5xl mr-3 flex-shrink-0">{player.avatar}</span>
                            )}
                            <span className="font-im-fell text-3xl text-black truncate">{player.name}</span>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                            {player.id === thisPlayerObject?.id ? (
                                <ReadyToggle
                                isReady={player.isReady}
                                onToggle={() => handleToggleReady(player)}
                                disabled={isProcessingAction}
                                />
                            ) : (
                                player.isReady ? (
                                <CheckSquare className="h-7 w-7 text-green-700" />
                                ) : (
                                <XSquare className="h-7 w-7 text-red-700" />
                                )
                            )}
                            </div>
                        </div>
                        ))}
                    </div>
                    <div className="flex-shrink-0 text-center px-4 space-y-3">
                        <p className="text-black font-semibold bg-amber-100/80 p-2 rounded-md shadow">
                            {lobbyMessage}
                        </p>
                        {showStartGameButton && (
                            <Button
                            onClick={handleStartGame}
                            disabled={isProcessingAction}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-6 rounded-lg shadow-lg animate-pulse"
                            >
                            {isProcessingAction ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-2 h-6 w-6" />}
                            START THE MAYHEM
                            </Button>
                        )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 w-full max-w-4xl flex items-center justify-center gap-4">
                   <Dialog>
                      <DialogTrigger asChild><Button variant="outline" size="sm" className="border-amber-800/50 text-amber-900 hover:bg-amber-100/80"><HelpCircle className="mr-1 h-4 w-4" /> How to Play</Button></DialogTrigger>
                      <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
                    </Dialog>
                    <Button onClick={handleResetGame} variant="outline" size="sm" className="border-amber-800/50 text-amber-900 hover:bg-amber-100/80" disabled={isProcessingAction || isLoading}>
                      { (isProcessingAction || isLoading) ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Reset Lobby
                    </Button>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    );
    
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-start py-8", currentStep === 'setup' ? 'lobby-background' : '')}>
        {mainContent}
      </div>
    );
  }

  // Fallback for initial "welcome" step (before ?step=setup)
  return (
    <div className="relative flex-grow flex flex-col bg-black">
      <Image
        src="/backgrounds/mobile-background.jpg"
        alt="Make It Terrible game poster background"
        fill
        className="object-contain object-top"
        priority
        data-ai-hint="game poster"
      />
      <div className="relative z-10 flex flex-grow items-center justify-center">
        <button
            onClick={() => {
              showGlobalLoader();
              router.push('/?step=setup');
            }}
            className="group animate-slow-scale-pulse"
        >
          <Image
            src="/ui/enter-the-chaos-button.png"
            alt="Enter the Chaos"
            width={252}
            height={95}
            className="object-contain drop-shadow-xl"
            data-ai-hint="chaos button"
            priority
          />
        </button>
      </div>
    </div>
  );
}
