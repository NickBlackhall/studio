
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
  
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  const setGame = useCallback((newGameState: GameClientState | null | ((prevState: GameClientState | null) => GameClientState | null)) => {
    if (typeof newGameState === 'function') {
      setInternalGame(prevState => {
        const resultState = newGameState(prevState);
        gameRef.current = resultState;
        return resultState;
      });
    } else {
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
      showGlobalLoader({ message: 'Finding the game...' });
    }
    
    try {
      let fetchedGameState = await getGame(gameIdToFetch); 
      
      if (fetchedGameState) {
        if (typeof fetchedGameState.ready_player_order_str === 'string') {
            fetchedGameState.ready_player_order = parseReadyPlayerOrderStr(fetchedGameState);
        } else if (typeof fetchedGameState.ready_player_order === 'undefined' || !Array.isArray(fetchedGameState.ready_player_order)) {
            fetchedGameState.ready_player_order = [];
        }
      } else {
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
      if (isMountedRef.current) {
         hideGlobalLoader(); 
      }
    }
  }, [toast, hideGlobalLoader, showGlobalLoader, parseReadyPlayerOrderStr, setGame, setThisPlayerId]);

  const handlePlayerAdded = useCallback(async (newPlayer: Tables<'players'>) => {
      showGlobalLoader({ message: 'Adding you to the lobby...' });
      const currentGameId = gameRef.current?.gameId;
      if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          await fetchGameData(`handlePlayerAdded after creating player ${newPlayer.id}`, currentGameId);
      }
      hideGlobalLoader();
  }, [fetchGameData, setThisPlayerId, showGlobalLoader, hideGlobalLoader]);


  useEffect(() => {
    isMountedRef.current = true;
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
      router.push('/game');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [internalGame, internalThisPlayerId, currentStep, router]);


  useEffect(() => {
    const gameId = internalGame?.gameId;
    if (!gameId) return;
  
    const fetchGameState = async () => {
      if (!isMountedRef.current) return;
      try {
        const fetchedGameState = await getGame(gameId);
        if (isMountedRef.current) {
          setGame(fetchedGameState);
        }
      } catch (error) {
        console.error(`Error in fetchGameState (lobby):`, error);
      }
    };
  
    const handleRealtimeUpdate = (payload: any) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        fetchGameState();
      }, 1200); 
    };
  
    const uniqueChannelSuffix = internalThisPlayerId || Date.now();
    const playersChannelName = `players-lobby-${gameId}-${uniqueChannelSuffix}`;
    const gameChannelName = `game-state-lobby-${gameId}-${uniqueChannelSuffix}`;
  
    const playersChannel = supabase
      .channel(playersChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, handleRealtimeUpdate)
      .subscribe();
  
    const gameChannel = supabase
      .channel(gameChannelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handleRealtimeUpdate)
      .subscribe();
        
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(gameChannel);
    };
  }, [internalGame?.gameId, internalThisPlayerId, setGame]);

  const thisPlayerObject = useMemo(() => {
    return internalThisPlayerId && internalGame?.players ? internalGame.players.find(p => p.id === internalThisPlayerId) : null;
  }, [internalThisPlayerId, internalGame?.players]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGame?.players) return [];
  
    const validPlayers = internalGame.players.filter((p): p is PlayerClientState => 
      typeof p === 'object' && p !== null && 'id' in p && 'name' in p
    );
    
    const currentPlayerId = internalThisPlayerId;
    
    return [...validPlayers].sort((a, b) => {
      if (currentPlayerId) {
        if (a.id === currentPlayerId) return -1;
        if (b.id === currentPlayerId) return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [internalGame?.players, internalThisPlayerId]);


  const handleResetGame = async () => {
    showGlobalLoader({ message: 'Resetting the entire game...' }); 
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
    if (!internalGame?.gameId || player.id !== internalThisPlayerId) return;
    
    setInternalGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p => 
          p.id === player.id ? { ...p, isReady: !p.isReady } : p
        )
      };
    });
    
    try {
      await togglePlayerReadyStatus(player.id, internalGame.gameId);
    } catch (error) {
      setGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === player.id ? { ...p, isReady: !p.isReady } : p
          )
        };
      });
      toast({ title: "Toggle failed", description: "Please try again" });
    }
  };

  const handleStartGame = async () => {
    const gameToStart = internalGame;
    if (gameToStart?.gameId && gameToStart.gamePhase === 'lobby') {
        showGlobalLoader({ message: 'Dealing cards and starting the mayhem...', players: gameToStart.players });
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
  
  if (!internalGame || !internalGame.gameId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 text-foreground">
        <p className="text-xl text-destructive mt-4">Could not initialize game session. Please try refreshing.</p>
         <Button onClick={() => { showGlobalLoader({ message: 'Refreshing...' }); window.location.reload(); }} variant="outline" className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  const isLobbyPhaseActive = internalGame.gamePhase === 'lobby';
  const isSpectatorView = !isLobbyPhaseActive && !thisPlayerObject;
  const isActivePlayerInNonLobby = !isLobbyPhaseActive && thisPlayerObject;


  if (currentStep === 'welcome') {
    return (
      <div className="relative flex-grow flex flex-col bg-black">
        <Image
          src="/backgrounds/mobile-background.jpg"
          alt="Make It Terrible game poster background"
          fill
          className="poster-image"
          priority
          data-ai-hint="game poster"
        />
        <div className="relative z-10 flex flex-grow items-center justify-center">
          <button
            onClick={() => {
              showGlobalLoader({ message: 'Loading setup...' });
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

    const mainContent = (
      <div className="w-full h-full flex flex-col items-center justify-center">
        {isSpectatorView ? (
          <div className="w-full max-w-md space-y-6 text-center p-4">
            
            <Card className="my-4 shadow-md border-2 border-destructive rounded-lg">
              <CardHeader className="p-4">
                <Lock className="h-8 w-8 mx-auto text-destructive mb-2" />
                <CardTitle className="text-xl font-semibold">Game in Progress!</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-sm">
                <p>Sorry, you&apos;ll have to wait until the next game to join. But you can still watch.</p>
              </CardContent>
            </Card>
            <div className="my-6 relative w-full max-w-sm mx-auto">
                <Image
                    src="/backgrounds/scoreboard-poster.png"
                    alt="Leaderboard"
                    width={512}
                    height={768}
                    className="object-contain"
                    data-ai-hint="scoreboard poster"
                />
                <div className="absolute left-[10%] right-[10%] bottom-[15%]" style={{ top: '45%' }}>
                    <Scoreboard players={internalGame.players} currentJudgeId={internalGame.currentJudgeId} />
                </div>
            </div>
            <Card className="shadow-md border-muted rounded-lg">
              <CardContent className="p-6">
                <p className="text-muted-foreground">The lobby will re-open once the current game finishes. Hang tight!</p>
              </CardContent>
            </Card>
            <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction}>
              { isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
            </Button>
          </div>
        ) : isActivePlayerInNonLobby ? (
          <div className="w-full max-w-md text-center p-4">
            
            <Card className="my-4 border-primary/50 bg-muted/30 shadow-md">
              <CardHeader className="p-4">
                <CardTitle className="text-lg flex items-center justify-center font-semibold text-foreground">
                  <Info className="mr-2 h-5 w-5 text-primary" /> Game in Progress!
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                <p>The current game is in the &quot;{internalGame.gamePhase}&quot; phase.</p>
                <Button
                  onClick={() => { showGlobalLoader({ message: 'Rejoining game...', players: internalGame.players }); router.push('/game'); }}
                  variant="default"
                  size="sm"
                  className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Rejoin Current Game <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction}>
              { isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
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
            } else {
              const hostPlayerForMsg = hostPlayerId && internalGame.players.find(p => p.id === hostPlayerId);
              const hostNameForMessage = hostPlayerForMsg?.name || 'The host';
              lobbyMessage = `Waiting for ${hostNameForMessage} to start the game.`;
            }
            if (allPlayersReady && hostPlayerId === thisPlayerIdRef.current) {
              lobbyMessage = "";
            }
            return (
              <div className="w-full h-screen">
                <div className="relative w-full h-full">
                  <Image
                    src="/backgrounds/lobby-poster.jpg"
                    alt="Lobby poster background"
                    fill
                    className="poster-image"
                    data-ai-hint="lobby poster"
                  />
                  <div className="absolute top-[23%] left-[10%] right-[10%] h-[68%] flex flex-col">
                    <div className="overflow-y-auto space-y-2">
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
                            <h2 className="text-3xl text-black truncate">{player.name}</h2>
                            </div>
                            <div className="flex-shrink-0 ml-2 flex items-center justify-center">
                            {player.id === thisPlayerObject?.id ? (
                                <ReadyToggle
                                isReady={player.isReady}
                                onToggle={() => handleToggleReady(player)}
                                disabled={isProcessingAction}
                                />
                            ) : (
                                player.isReady ? (
                                <CheckSquare className="h-12 w-20 text-green-700" />
                                ) : (
                                <XSquare className="h-12 w-20 text-red-700" />
                                )
                            )}
                            </div>
                        </div>
                        ))}
                    </div>
                    <div className="flex-shrink-0 text-center px-4 pt-4 space-y-2">
                      <p className="bg-transparent font-semibold text-black">
                        {lobbyMessage}
                      </p>
                       {showStartGameButton ? (
                         <button
                          onClick={handleStartGame}
                          disabled={isProcessingAction}
                          className="group animate-slow-scale-pulse disabled:animate-none disabled:opacity-70"
                        >
                          {isProcessingAction ? (
                            <div className="h-[71.52px] flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-black" />
                            </div>
                          ) : (
                            <Image
                              src="/ui/start-game-button.png"
                              alt="Start the Mayhem"
                              width={189.84 * 1.2 * 1.2}
                              height={71.52 * 1.2 * 1.2}
                              className="object-contain drop-shadow-xl"
                              data-ai-hint="start button"
                              priority
                            />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="absolute bottom-[2%] left-0 right-0 flex items-center justify-center gap-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="bg-transparent border-none p-0">
                          <Image
                            src="/ui/how-to-play-button.png"
                            alt="How to Play"
                            width={118}
                            height={44}
                            className="object-contain"
                            data-ai-hint="how to play button"
                            priority
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
                    </Dialog>
                    <Button onClick={handleResetGame} variant="outline" size="sm" className="border-amber-800/50 text-amber-900 hover:bg-amber-100/80" disabled={isProcessingAction}>
                      { isProcessingAction ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Reset Lobby
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    );
    
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center bg-black")}>
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
        className="poster-image"
        priority
        data-ai-hint="game poster"
      />
      <div className="relative z-10 flex flex-grow items-center justify-center">
        <button
            onClick={() => {
              showGlobalLoader({ message: 'Loading setup...' });
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
