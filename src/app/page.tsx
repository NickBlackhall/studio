
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { addPlayer as addPlayerAction, resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction } from '@/app/game/actions';
import { Users, Play, ArrowRight, RefreshCw, Loader2, CheckSquare, XSquare, Info, Lock } from 'lucide-react';
import type { PlayerClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START, ACTIVE_PLAYING_PHASES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import React, { useEffect, useCallback, useTransition, useRef, useMemo, startTransition, Suspense } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';
import ReadyToggle from '@/components/game/ReadyToggle';
import PWAGameLayout from '@/components/PWAGameLayout';
import type { Tables } from '@/lib/database.types';
import { useAudio } from '@/contexts/AudioContext';
import { useSharedGame } from '@/contexts/SharedGameContext';
import { useLoading } from '@/contexts/LoadingContext';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import ConfigurationError from '@/components/ConfigurationError';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import { Volume2, VolumeX, Music, Zap, HelpCircle, Home } from 'lucide-react';

export const dynamic = 'force-dynamic';


function WelcomePageContent() {
  // Check configuration first
  if (!isSupabaseConfigured()) {
    return (
      <ConfigurationError 
        title="Game Configuration Error"
        message="The game cannot start because it's missing required configuration."
        details={[
          !process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL is not set" : "",
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set" : ""
        ].filter(Boolean)}
      />
    );
  }

  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isProcessingAction, startPlayerActionTransition] = useTransition();
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const { playTrack, state: audioState, toggleMute, toggleMusicMute, toggleSfxMute } = useAudio();
  const { gameState: internalGameState, thisPlayer, setThisPlayer } = useSharedGame();
  const { setGlobalLoading } = useLoading();
  const [isMenuModalOpen, setIsMenuModalOpen] = React.useState(false);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = React.useState(false);
  
  const currentStepQueryParam = searchParams?.get('step');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 'welcome';
  
  
  const handlePlayerAdded = useCallback(async (newPlayer: Tables<'players'>) => {
    if (newPlayer && newPlayer.id && internalGameState?.gameId && isMountedRef.current) {
      console.log(`LOBBY: handlePlayerAdded - Player ${newPlayer.id} added to game ${internalGameState.gameId}.`);
      const localStorageKey = `thisPlayerId_game_${internalGameState.gameId}`;
      localStorage.setItem(localStorageKey, newPlayer.id);
      
      // Directly update thisPlayer in SharedGameContext
      const playerClientState: PlayerClientState = {
        id: newPlayer.id,
        name: newPlayer.name || '',
        avatar: newPlayer.avatar || '',
        isReady: newPlayer.is_ready || false,
        score: newPlayer.score || 0,
        isJudge: false, // Will be updated by real-time updates
        hand: [] // Initialize empty hand for lobby
      };
      console.log(`LOBBY: handlePlayerAdded - Setting thisPlayer directly:`, playerClientState);
      setThisPlayer(playerClientState);
    }
  }, [internalGameState?.gameId, setThisPlayer]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);


  useEffect(() => {
    if (currentStep === 'welcome' || currentStep === 'setup') playTrack('lobby-music');
  }, [currentStep, playTrack]);
  
  const hasNavigatedRef = useRef(false);
  
  useEffect(() => {
    if (internalGameState && internalGameState.gamePhase !== 'lobby' && internalGameState.gamePhase !== 'game_over' && thisPlayer && !hasNavigatedRef.current) {
      console.log(`LOBBY: Game phase is ${internalGameState.gamePhase}, navigating to /game with atomic loading.`);
      hasNavigatedRef.current = true; // Prevent multiple navigations
      
      // Use startTransition to batch loading flag + navigation in same render cycle
      startTransition(() => {
        setGlobalLoading(true);   // Show overlay before navigation
        router.push('/game');
      });
    }
  }, [internalGameState, thisPlayer, router, setGlobalLoading]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGameState?.players) return [];
    const validPlayers = internalGameState.players.filter((p): p is PlayerClientState => typeof p === 'object' && p !== null && 'id' in p && 'name' in p);
    return [...validPlayers].sort((a, b) => {
      if (thisPlayer) {
        if (a.id === thisPlayer.id) return -1;
        if (b.id === thisPlayer.id) return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [internalGameState?.players, thisPlayer?.id]);


  const handleResetGame = async () => {
    startPlayerActionTransition(async () => {
      try {
        console.log("LOBBY: handleResetGame - User clicked reset.");
        await resetGameForTesting();
      } catch (error: any) {
        if (!isMountedRef.current || (typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))) return; 
        toast({ title: "Reset Failed", description: `Could not reset the game. ${error.message || String(error)}`, variant: "destructive" });
      }
    });
  };

  const handleToggleReady = async (player: PlayerClientState) => {
    if (!internalGameState?.gameId || player.id !== thisPlayer?.id) return;
    console.log(`LOBBY: handleToggleReady triggered for player ${player.id}. Current ready: ${player.isReady}`);
    
    // Optimistic update to thisPlayer state
    const updatedPlayer = { ...player, isReady: !player.isReady };
    setThisPlayer(updatedPlayer);
    console.log(`LOBBY: Optimistically updated thisPlayer ready status to: ${updatedPlayer.isReady}`);
    
    try {
      await togglePlayerReadyStatus(player.id, internalGameState.gameId);
      console.log(`LOBBY: Server ready status update successful`);
    } catch (error) {
      // Revert optimistic update on error
      setThisPlayer(player);
      console.log(`LOBBY: Ready status update failed, reverted to: ${player.isReady}`);
      toast({ title: "Toggle failed", description: "Please try again" });
    }
  };

  const handleStartGame = async () => {
    if (internalGameState?.gameId && internalGameState.gamePhase === 'lobby') {
      console.log("LOBBY: handleStartGame - User clicked Start Game.");
      startPlayerActionTransition(async () => {
        try {
          await startGameAction(internalGameState.gameId);
        } catch (error: any) {
          if (isMountedRef.current) {
            toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
          }
        }
      });
    }
  };

  const renderContent = () => {
    if (!internalGameState || !internalGameState.gameId) {
      return <div className="flex-grow flex items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
    }

    if (currentStep === 'welcome') {
      return (
        <div className="relative flex-grow flex flex-col bg-black">
          <Image src="/backgrounds/mobile-background.jpg" alt="Make It Terrible background" fill className="poster-image" priority data-ai-hint="game poster" />
          <div className="relative z-10 flex flex-grow items-center justify-center">
            <button onClick={() => router.push('/?step=setup')} className="group animate-slow-scale-pulse">
              <Image src="/ui/enter-the-chaos-button.png" alt="Enter the Chaos" width={252} height={95} className="object-contain drop-shadow-xl" data-ai-hint="chaos button" priority />
            </button>
          </div>
        </div>
      );
    }
  
    if (currentStep === 'setup') {
      if (internalGameState.gamePhase === 'lobby') {
        if (!thisPlayer) {
          console.log("LOBBY: Rendering PWAGameLayout for new player setup.");
          return <PWAGameLayout gameId={internalGameState.gameId} onPlayerAdded={handlePlayerAdded} />;
        }
  
        const hostPlayerId = internalGameState.ready_player_order.length > 0 ? internalGameState.ready_player_order[0] : null;
        const enoughPlayers = internalGameState.players.length >= MIN_PLAYERS_TO_START;
        const allPlayersReady = enoughPlayers && internalGameState.players.every(p => p.isReady);
        const showStartGameButton = thisPlayer.id === hostPlayerId && enoughPlayers && allPlayersReady;
  
        let lobbyMessage = "";
        if (!enoughPlayers) lobbyMessage = `Need at least ${MIN_PLAYERS_TO_START} players. Waiting for ${MIN_PLAYERS_TO_START - (internalGameState.players?.length || 0)} more...`;
        else if (!allPlayersReady) {
          const unreadyCount = internalGameState.players.filter(p => !p.isReady).length;
          lobbyMessage = `Waiting for ${unreadyCount} player${unreadyCount > 1 ? 's' : ''} to ready up.`;
        } else if (!showStartGameButton) {
          const hostPlayerForMsg = hostPlayerId && internalGameState.players.find(p => p.id === hostPlayerId);
          lobbyMessage = `Waiting for ${(hostPlayerForMsg as any)?.name || 'The host'} to start the game.`;
        }
        
        const PlayerRow = React.memo(function PlayerRow({ player }: { player: PlayerClientState }) {
          return (
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center min-w-0">
                {player.avatar?.startsWith('/') ? <Image src={player.avatar} alt={`${(player.name as string) || "Player"}'s avatar`} width={56} height={56} className="mr-3 rounded-sm object-cover flex-shrink-0" data-ai-hint="player avatar" loading="lazy" /> : <span className="text-5xl mr-3 flex-shrink-0">{player.avatar}</span>}
                <h2 className="text-3xl text-black truncate">{(player.name as string) || 'Player'}</h2>
              </div>
              <div className="flex-shrink-0 ml-2 flex items-center justify-center">
                {player.id === thisPlayer?.id ? <ReadyToggle isReady={player.isReady} onToggle={() => handleToggleReady(player)} disabled={isProcessingAction} /> : (player.isReady ? <CheckSquare className="h-12 w-20 text-green-700" /> : <XSquare className="h-12 w-20 text-red-700" />)}
              </div>
            </div>
          );
        });
        PlayerRow.displayName = 'PlayerRow';

        console.log("LOBBY: Rendering main lobby view.");
        return (
          <div className="w-full h-screen animate-in fade-in duration-700 ease-out">
            <div className="relative w-full h-full">
              <Image src="/backgrounds/lobby-poster.jpg" alt="Lobby background" fill className="poster-image" data-ai-hint="lobby poster" />
              <div className="absolute top-[23%] left-[10%] right-[10%] h-[68%] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 ease-out">
                <div className="overflow-y-auto space-y-2">{sortedPlayersForDisplay.map((player) => <PlayerRow key={player.id} player={player} />)}</div>
                <div className="flex-shrink-0 text-center px-4 pt-4 space-y-2">
                  <p className="bg-transparent font-semibold text-black">{lobbyMessage}</p>
                  {showStartGameButton && (
                    <button onClick={handleStartGame} disabled={isProcessingAction} className="group animate-slow-scale-pulse disabled:animate-none disabled:opacity-70">
                      {isProcessingAction ? <div className="h-[71.52px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-black" /></div> : <Image src="/ui/start-game-button.png" alt="Start the Mayhem" width={189.84 * 1.2 * 1.2} height={71.52 * 1.2 * 1.2} className="object-contain drop-shadow-xl" data-ai-hint="start button" priority />}
                    </button>
                  )}
                </div>
              </div>
              <div className="absolute bottom-[2%] left-0 right-0 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500 ease-out">
                <button onClick={() => setIsMenuModalOpen(true)} className="bg-transparent border-none p-0">
                  <Image src="/ui/menu-button-v2.png" alt="Game Menu" width={118} height={44} className="object-contain" data-ai-hint="menu button" priority />
                </button>
              </div>
            </div>
          </div>
        );
      } else if (!localStorage.getItem(`thisPlayerId_game_${internalGameState.gameId}`)) {
        console.log("LOBBY: Rendering spectator view for game in progress.");
        return (
          <div className="w-full h-full flex flex-col justify-center items-center">
            <div className="w-full max-w-md space-y-6 text-center p-4">
              <Card className="my-4 shadow-md border-2 border-destructive rounded-lg"><CardHeader className="p-4"><Lock className="h-8 w-8 mx-auto text-destructive mb-2" /><CardTitle className="text-xl font-semibold">Game in Progress!</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-sm"><p>Sorry, you&apos;ll have to wait. But you can still watch.</p></CardContent></Card>
              <div className="my-6 relative w-full max-w-sm mx-auto">
                <Image src="/backgrounds/scoreboard-poster.png" alt="Leaderboard" width={512} height={768} className="object-contain" data-ai-hint="scoreboard poster" />
                <div className="absolute left-[10%] right-[10%] bottom-[15%]" style={{ top: '45%' }}><Scoreboard players={internalGameState.players} currentJudgeId={internalGameState.currentJudgeId} /></div>
              </div>
              <Card className="shadow-md border-muted rounded-lg"><CardContent className="p-6"><p className="text-muted-foreground">The lobby will re-open once the current game finishes.</p></CardContent></Card>
              <Button onClick={handleResetGame} variant="destructive" className="mt-6" disabled={isProcessingAction}>{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)</Button>
            </div>
          </div>
        );
      }
    }
    return null;
  };
  
  return (
    <div className={cn("min-h-screen flex flex-col bg-black")}>
      <div className="flex-grow flex flex-col justify-center">{renderContent()}</div>
      
      {/* Menu Modal */}
      <PureMorphingModal
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        variant="settings"
        icon="⚙️"
        title="Game Menu"
      >
        <div className="text-black/90 mb-5">
          Options and actions for the game.
        </div>
        <div className="flex flex-col gap-3">
          <div className="text-black/80 text-sm font-medium mb-2">Audio Controls</div>
          <Button
            variant="outline"
            onClick={toggleMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.isMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            {audioState.isMuted ? 'Unmute All Audio' : 'Mute All Audio'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleMusicMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.musicMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Music className="mr-2 h-4 w-4" />}
            {audioState.musicMuted ? 'Unmute Music' : 'Mute Music'}
          </Button>
          <Button
            variant="outline"
            onClick={toggleSfxMute}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            {audioState.sfxMuted ? <VolumeX className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
            {audioState.sfxMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setIsMenuModalOpen(false);
              setIsHowToPlayModalOpen(true);
            }}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            <HelpCircle className="mr-2 h-4 w-4" /> How to Play
          </Button>
          <Button
            onClick={() => {
              handleResetGame();
              setIsMenuModalOpen(false);
            }}
            className="bg-red-500/80 hover:bg-red-600/80 text-white"
            disabled={isProcessingAction}
          >
            {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reset Game (Testing)
          </Button>
        </div>
      </PureMorphingModal>

      {/* How to Play Modal */}
      <Dialog open={isHowToPlayModalOpen} onOpenChange={setIsHowToPlayModalOpen}>
        <DialogContent className="max-w-2xl">
          <HowToPlayModalContent />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="flex-grow flex items-center justify-center bg-black"><div className="text-white">Loading...</div></div>}>
      <WelcomePageContent />
    </Suspense>
  );
}

    