
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, CheckSquare, XSquare, HelpCircle, Info, Lock } from 'lucide-react';
import type { GameClientState, PlayerClientState, GamePhaseClientState, TransitionState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import React, { useState, useEffect, useCallback, useTransition, useRef, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';
import ReadyToggle from '@/components/game/ReadyToggle';
import PWAGameLayout from '@/components/PWAGameLayout';
import type { Tables } from '@/lib/database.types';
import { useAudio } from '@/contexts/AudioContext';
import { useLoading } from '@/contexts/LoadingContext';
import { useGameNavigation } from '@/hooks/useGameNavigation';
import { useTargetedGameSubscription } from '@/hooks/useTargetedGameSubscription';
import { getGame } from '@/app/game/actions';
import { debounce } from 'lodash';

export const dynamic = 'force-dynamic';

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [internalGameState, setInternalGameState] = useState<GameClientState | null>(null);
  const [thisPlayerId, setThisPlayerId] = useState<string | null>(null);

  const gameRef = useRef<GameClientState | null>(null);
  
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const { playTrack } = useAudio();
  const { showLoader, hideLoader, isLoading } = useLoading();
  
  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';
  
  useGameNavigation({ gameState: internalGameState, thisPlayerId, currentPath: pathname });

  useTargetedGameSubscription({
    gameId: internalGameState?.gameId || null,
    setGameState: setInternalGameState,
  });

  useEffect(() => {
    gameRef.current = internalGameState;
  }, [internalGameState]);

  const fetchInitialData = useCallback(async () => {
    let fetchedGameState: GameClientState | null = null;
    let playerIdFromStorage: string | null = null;
    try {
      fetchedGameState = await getGame(); 
      if (!isMountedRef.current) return;

      setInternalGameState(fetchedGameState); 

      if (fetchedGameState && fetchedGameState.gameId) {
        const localStorageKey = `thisPlayerId_game_${fetchedGameState.gameId}`;
        playerIdFromStorage = localStorage.getItem(localStorageKey);
        
        if (playerIdFromStorage) {
            const playerInGame = fetchedGameState.players.some(p => p.id === playerIdFromStorage);
            if (playerInGame) {
              setThisPlayerId(playerIdFromStorage);
            } else {
              localStorage.removeItem(localStorageKey);
              setThisPlayerId(null);
            }
        } else {
          setThisPlayerId(null); 
        }
      } else { 
        setThisPlayerId(null);
        if (isMountedRef.current) {
            setInternalGameState(null); 
            toast({ title: "Game Session Error", description: "Could not initialize or find the game session. Please try refreshing or resetting.", variant: "destructive"});
        }
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setInternalGameState(null);
        setThisPlayerId(null);
        toast({ title: "Load Error", description: `Could not fetch game state: ${error.message || String(error)}`, variant: "destructive"});
      }
    }
  }, [toast]);

  const handlePlayerAdded = useCallback(async (newPlayer: Tables<'players'>) => {
      const currentGameId = gameRef.current?.gameId;
      if (newPlayer && newPlayer.id && currentGameId && isMountedRef.current) {
          const localStorageKey = `thisPlayerId_game_${currentGameId}`;
          localStorage.setItem(localStorageKey, newPlayer.id);
          setThisPlayerId(newPlayer.id);
          const fullGameState = await getGame(currentGameId);
          setInternalGameState(fullGameState);
      }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchInitialData]);

  useEffect(() => {
    if (currentStep === 'welcome' || currentStep === 'setup') {
      playTrack('lobby-music');
    }
  }, [currentStep, playTrack]);

  useEffect(() => {
    const game = internalGameState;
    if (!game) return;

    if (game.transitionState !== 'idle' && game.gamePhase === 'lobby') {
       showLoader(game.transitionState, {
          message: game.transitionMessage || 'Loading...',
          players: game.players
        });
    } else if (isLoading && game.transitionState === 'idle') {
        hideLoader();
    }
  }, [internalGameState?.transitionState, internalGameState?.gamePhase, internalGameState?.transitionMessage, internalGameState?.players, showLoader, hideLoader, isLoading]);

  const thisPlayerObject = useMemo(() => {
    return thisPlayerId && internalGameState?.players ? internalGameState.players.find(p => p.id === thisPlayerId) : null;
  }, [thisPlayerId, internalGameState?.players]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGameState?.players) return [];
  
    const validPlayers = internalGameState.players.filter((p): p is PlayerClientState => 
      typeof p === 'object' && p !== null && 'id' in p && 'name' in p
    );
    
    return [...validPlayers].sort((a, b) => {
      if (thisPlayerId) {
        if (a.id === thisPlayerId) return -1;
        if (b.id === thisPlayerId) return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [internalGameState?.players, thisPlayerId]);


  const handleResetGame = async () => {
    startPlayerActionTransition(async () => {
      try {
        await resetGameForTesting();
      } catch (error: any) {
        if (!isMountedRef.current) return; 
        if (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) return; 
        toast({
          title: "Reset Failed",
          description: `Could not reset the game. ${error.message || String(error)}`,
          variant: "destructive",
        });
      }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    if (!internalGameState?.gameId || player.id !== thisPlayerId) return;
    
    setInternalGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p => 
          p.id === player.id ? { ...p, isReady: !p.isReady } : p
        )
      };
    });
    
    try {
      await togglePlayerReadyStatus(player.id, internalGameState.gameId);
    } catch (error) {
      setInternalGameState(prev => {
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
    const gameToStart = gameRef.current;
    if (gameToStart?.gameId && gameToStart.gamePhase === 'lobby') {
      startPlayerActionTransition(async () => {
        try {
          await startGameAction(gameToStart.gameId);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
          }
        }
      });
    } else {
        console.warn("Lobby: handleStartGame called, but conditions not met.", {
            gameId: gameToStart?.gameId,
            gamePhase: gameToStart?.gamePhase
        });
    }
  };

  const renderContent = () => {
    if (!internalGameState || !internalGameState.gameId) {
      return (
        <div className="flex-grow flex items-center justify-center bg-black">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      );
    }

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
              onClick={() => router.push('/?step=setup')}
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
      if (internalGameState.gamePhase === 'lobby') {
        if (!thisPlayerObject) {
          return <PWAGameLayout gameId={internalGameState.gameId} onPlayerAdded={handlePlayerAdded} />;
        }
  
        const hostPlayerId = internalGameState.ready_player_order.length > 0 ? internalGameState.ready_player_order[0] : null;
        const enoughPlayers = internalGameState.players.length >= MIN_PLAYERS_TO_START;
        const allPlayersReady = enoughPlayers && internalGameState.players.every(p => p.isReady);
        const showStartGameButton = thisPlayerId === hostPlayerId && enoughPlayers && allPlayersReady;
  
        let lobbyMessage = "";
        if (!enoughPlayers) {
          lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players. Waiting for ${MIN_PLAYERS_TO_START - (internalGameState.players?.length || 0)} more...`;
        } else if (!allPlayersReady) {
          const unreadyCount = internalGameState.players.filter(p => !p.isReady).length;
          lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to ready up.`;
        } else if (!showStartGameButton) {
          const hostPlayerForMsg = hostPlayerId && internalGameState.players.find(p => p.id === hostPlayerId);
          const hostNameForMessage = (hostPlayerForMsg as any)?.name || 'The host';
          lobbyMessage = `Waiting for ${hostNameForMessage} to start the game.`;
        }
        const PlayerRow = React.memo(function PlayerRow({ 
          player 
        }: { 
          player: PlayerClientState 
        }) {
          return (
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center min-w-0">
                {player.avatar?.startsWith('/') ? (
                  <Image
                    src={player.avatar}
                    alt={`${(player.name as string) || "Player"}'s avatar`}
                    width={56}
                    height={56}
                    className="mr-3 rounded-sm object-cover flex-shrink-0"
                    data-ai-hint="player avatar"
                  />
                ) : (
                  <span className="text-5xl mr-3 flex-shrink-0">{player.avatar}</span>
                )}
                <h2 className="text-3xl text-black truncate">{(player.name as string) || 'Player'}</h2>
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
          );
        });
        PlayerRow.displayName = 'PlayerRow';
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
                    <PlayerRow key={player.id} player={player} />
                  ))}
                </div>
                <div className="flex-shrink-0 text-center px-4 pt-4 space-y-2">
                  <p className="bg-transparent font-semibold text-black">{lobbyMessage}</p>
                  {showStartGameButton && (
                    <button onClick={handleStartGame} disabled={isProcessingAction} className="group animate-slow-scale-pulse disabled:animate-none disabled:opacity-70">
                      {isProcessingAction ? (
                        <div className="h-[71.52px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-black" /></div>
                      ) : (
                        <Image src="/ui/start-game-button.png" alt="Start the Mayhem" width={189.84 * 1.2 * 1.2} height={71.52 * 1.2 * 1.2} className="object-contain drop-shadow-xl" data-ai-hint="start button" priority />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="absolute bottom-[2%] left-0 right-0 flex items-center justify-center gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="bg-transparent border-none p-0"><Image src="/ui/how-to-play-button.png" alt="How to Play" width={118} height={44} className="object-contain" data-ai-hint="how to play button" priority /></button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl"><HowToPlayModalContent /></DialogContent>
                </Dialog>
                <Button onClick={handleResetGame} variant="outline" size="sm" className="border-amber-800/50 text-amber-900 hover:bg-amber-100/80" disabled={isProcessingAction}>
                  {isProcessingAction ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Reset Lobby
                </Button>
              </div>
            </div>
          </div>
        );
      } else if (!localStorage.getItem(`thisPlayerId_game_${internalGameState.gameId}`)) {
        return (
          <div className="w-full h-full flex flex-col justify-center items-center">
            <div className="w-full max-w-md space-y-6 text-center p-4">
              <Card className="my-4 shadow-md border-2 border-destructive rounded-lg">
                <CardHeader className="p-4"><Lock className="h-8 w-8 mx-auto text-destructive mb-2" /><CardTitle className="text-xl font-semibold">Game in Progress!</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 text-sm"><p>Sorry, you&apos;ll have to wait until the next game to join. But you can still watch.</p></CardContent>
              </Card>
              <div className="my-6 relative w-full max-w-sm mx-auto">
                <Image src="/backgrounds/scoreboard-poster.png" alt="Leaderboard" width={512} height={768} className="object-contain" data-ai-hint="scoreboard poster" />
                <div className="absolute left-[10%] right-[10%] bottom-[15%]" style={{ top: '45%' }}>
                  <Scoreboard players={internalGameState.players} currentJudgeId={internalGameState.currentJudgeId} />
                </div>
              </div>
              <Card className="shadow-md border-muted rounded-lg"><CardContent className="p-6"><p className="text-muted-foreground">The lobby will re-open once the current game finishes. Hang tight!</p></CardContent></Card>
              <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction}>
                {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)
              </Button>
            </div>
          </div>
        );
      }
    }
    return null;
  };
  
  return (
    <div className={cn("min-h-screen flex flex-col bg-black")}>
      <div className="flex-grow flex flex-col justify-center">
        {renderContent()}
      </div>
    </div>
  );
}
