
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { resetGameForTesting, togglePlayerReadyStatus, startGame as startGameAction, createRoom, findAvailableRoomForQuickJoin } from '@/app/game/actions';
import { findGameByRoomCodeWithPlayers } from '@/lib/roomCodes';
import { RefreshCw, Loader2, Lock } from 'lucide-react';
import type { PlayerClientState } from '@/lib/types';
import { MIN_PLAYERS_TO_START } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';
import React, { useEffect, useCallback, useTransition, useRef, useMemo, startTransition, Suspense } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import HowToPlayModalContent from '@/components/game/HowToPlayModalContent';
import Scoreboard from '@/components/game/Scoreboard';
import PWAGameLayout from '@/components/PWAGameLayout';
import type { Tables } from '@/lib/database.types';
import { useAudio } from '@/contexts/AudioContext';
import { useSharedGame } from '@/contexts/SharedGameContext';
import { useLoading } from '@/contexts/LoadingContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import ConfigurationError from '@/components/ConfigurationError';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import PinCodeModal from '@/components/PinCodeModal';
import DevConsoleModal from '@/components/DevConsoleModal';
import MainMenu from '@/components/MainMenu';
import CreateRoomModal, { type RoomSettings } from '@/components/room/CreateRoomModal';
import JoinRoomModal from '@/components/room/JoinRoomModal';
import RoomBrowserModal from '@/components/room/RoomBrowserModal';
import LobbyLayout from '@/components/lobby/LobbyLayout';
import LobbyPlayerList from '@/components/lobby/LobbyPlayerList';
import LobbyStatusMessage from '@/components/lobby/LobbyStatusMessage';
import LobbyStartButton from '@/components/lobby/LobbyStartButton';
import { Volume2, VolumeX, Music, Zap, HelpCircle, Edit, Terminal } from 'lucide-react';

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
  const { gameState: internalGameState, thisPlayer, setThisPlayer, setGameState, joinGameByRoomCode, isInitializing } = useSharedGame();
  const { setGlobalLoading } = useLoading();
  const [isMenuModalOpen, setIsMenuModalOpen] = React.useState(false);
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = React.useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = React.useState(false);
  const [isDevConsoleOpen, setIsDevConsoleOpen] = React.useState(false);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = React.useState(false);
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = React.useState(false);
  const [isRoomBrowserModalOpen, setIsRoomBrowserModalOpen] = React.useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = React.useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = React.useState(false);
  
  const currentStepQueryParam = searchParams?.get('step');
  const roomCodeParam = searchParams?.get('room');
  const currentStep = currentStepQueryParam === 'setup' ? 'setup' : 
                     currentStepQueryParam === 'menu' ? 'menu' : 'welcome';
  
  
  const handlePlayerAdded = useCallback(async (newPlayer: Tables<'players'>) => {
    if (newPlayer && newPlayer.id && internalGameState?.gameId && isMountedRef.current) {
      console.log(`🔵 LOBBY: handlePlayerAdded - Player ${newPlayer.name} (${newPlayer.id}) added to game ${internalGameState.gameId}.`);
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
      console.log(`🔵 LOBBY: handlePlayerAdded - Setting thisPlayer to ${newPlayer.name} in game ${internalGameState.gameId}`);
      setThisPlayer(playerClientState);
    }
  }, [internalGameState?.gameId, setThisPlayer]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);


  useEffect(() => {
    if (currentStep === 'welcome' || currentStep === 'menu' || currentStep === 'setup') playTrack('lobby-music');
  }, [currentStep, playTrack]);
  
  const hasNavigatedRef = useRef(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Navigation is now purely server-driven via real-time subscriptions
  // No client-side timeout fallback to prevent race conditions
  useEffect(() => {
    // Server-driven navigation: Only navigate when game phase changes AND transition is complete
    if (internalGameState && 
        internalGameState.gamePhase !== 'lobby' && 
        internalGameState.gamePhase !== 'game_over' && 
        internalGameState.transitionState === 'idle' && // Wait for server to signal completion
        thisPlayer && 
        !hasNavigatedRef.current) {
      
      console.log(`🔄 LOBBY: Server-driven navigation triggered - phase: ${internalGameState.gamePhase}, transition: ${internalGameState.transitionState}`);
      hasNavigatedRef.current = true; // Prevent multiple navigations
      
      // Preserve room code when navigating to game page
      const roomCode = searchParams.get('room');
      const gameUrl = roomCode ? `/game?room=${roomCode}` : '/game';
      
      // Set loading state immediately to prevent gap
      setGlobalLoading(true);
      
      // Small delay to ensure loading overlay appears before navigation
      setTimeout(() => {
        startTransition(() => {
          router.push(gameUrl);
        });
      }, 50); // 50ms delay to ensure smooth overlay transition
    }
  }, [internalGameState?.gamePhase, internalGameState?.transitionState, thisPlayer, router, setGlobalLoading, searchParams]);

  const sortedPlayersForDisplay = useMemo(() => {
    if (!internalGameState?.players) return [];
    const validPlayers = internalGameState.players.filter((p): p is PlayerClientState => typeof p === 'object' && p !== null && 'id' in p && 'name' in p);
    
    // Merge optimistic thisPlayer state for immediate responsiveness
    const playersWithOptimisticState = validPlayers.map(player => {
      // For the current player, use optimistic state from thisPlayer for immediate UI feedback
      if (thisPlayer && player.id === thisPlayer.id) {
        return { ...player, ...thisPlayer };
      }
      // For other players, use server state
      return player;
    });
    
    return [...playersWithOptimisticState].sort((a, b) => {
      if (thisPlayer) {
        if (a.id === thisPlayer.id) return -1;
        if (b.id === thisPlayer.id) return 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [internalGameState?.players, thisPlayer]);


  const handleResetGameWithPin = () => {
    setIsPinModalOpen(true);
  };

  const handleResetGame = async () => {
    startPlayerActionTransition(async () => {
      try {
        console.log("LOBBY: handleResetGame - User clicked reset.");
        
        if (!internalGameState?.gameId) {
          console.error("LOBBY: handleResetGame - No gameId available for reset");
          toast({ title: "Reset Failed", description: "No active game to reset", variant: "destructive" });
          return;
        }
        
        // Call the server action with specific game ID - it will handle the transition state and reset
        console.log(`LOBBY: handleResetGame - Calling server reset action for game ${internalGameState.gameId}`);
        await resetGameForTesting({ clientWillNavigate: true, gameId: internalGameState.gameId });
        console.log("LOBBY: handleResetGame - Server reset completed");
      } catch (error: any) {
        if (typeof error?.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
          // This is expected when the server redirects
          console.log("LOBBY: handleResetGame - Server redirect received");
          return;
        }
        
        if (!isMountedRef.current) return;
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
    if (internalGameState?.gameId && internalGameState.gamePhase === 'lobby' && thisPlayer?.id) {
      console.log("LOBBY: handleStartGame - User clicked Start Game.");
      
      // Temporarily set client-side transition state to block UI
      setGameState({
        ...internalGameState,
        transitionState: 'starting_game',
        transitionMessage: 'Starting game...'
      });
      
      startPlayerActionTransition(async () => {
        try {
          // Pass the current player's ID for host validation
          await startGameAction(internalGameState.gameId, thisPlayer.id);
        } catch (error: any) {
          // Restore on error
          setGameState({
            ...internalGameState,
            transitionState: 'idle',
            transitionMessage: null
          });
          if (isMountedRef.current) {
            toast({ title: "Error Starting Game", description: error.message || String(error), variant: "destructive" });
          }
        }
      });
    }
  };

  // Room Management Functions
  const handleCreateRoom = async (roomSettings: RoomSettings) => {
    setIsCreatingRoom(true);
    try {
      console.log('Creating room with settings:', roomSettings);
      
      const newGame = await createRoom(
        roomSettings.roomName, 
        roomSettings.isPublic, 
        roomSettings.maxPlayers
      );
      
      // Update the context with the new game
      await joinGameByRoomCode(newGame.room_code);
      
      toast({ 
        title: "Room Created!", 
        description: `Room "${roomSettings.roomName}" created with code: ${newGame.room_code}` 
      });
      
      setIsCreateRoomModalOpen(false);
      // Update the URL to show room code (lobby will render automatically)
      router.push(`/?room=${newGame.room_code}`, { scroll: false });
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    // CRITICAL: Block room joining during reset
    const resetFlag = localStorage.getItem('gameResetFlag');
    if (resetFlag === 'true') {
      console.log(`MAIN: handleJoinRoom - Blocked due to reset flag`);
      return;
    }
    
    setIsJoiningRoom(true);
    try {
      console.log(`MAIN: handleJoinRoom - Attempting to join room with code: ${roomCode}`);
      
      // Validate room exists and is joinable
      const gameData = await findGameByRoomCodeWithPlayers(roomCode);
      
      if (!gameData) {
        throw new Error(`Room ${roomCode} not found`);
      }

      console.log(`MAIN: handleJoinRoom - Found game ${gameData.id} for room ${roomCode}, phase: ${gameData.game_phase}, players: ${gameData.currentPlayers}/${gameData.max_players}`);

      // Check if game is in a joinable state
      if (gameData.game_phase !== 'lobby') {
        throw new Error(`Room ${roomCode} is already in progress (${gameData.game_phase}). Cannot join now.`);
      }

      // Check if room is full
      if (gameData.availableSlots <= 0) {
        throw new Error(`Room ${roomCode} is full (${gameData.currentPlayers}/${gameData.max_players} players). Cannot join.`);
      }
      
      // Update the context with the joined game
      await joinGameByRoomCode(roomCode);
      
      toast({ 
        title: "Joining Room!", 
        description: `Joining room ${roomCode} (${gameData.room_name || 'Unnamed Room'})` 
      });
      
      setIsJoinRoomModalOpen(false);
      setIsRoomBrowserModalOpen(false);
      
      // Update the URL to show room code (lobby will render automatically)
      router.push(`/?room=${roomCode}`, { scroll: false });
      
    } catch (error: any) {
      console.error('MAIN: handleJoinRoom - Error:', error.message);
      toast({ 
        title: "Failed to join room", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleQuickJoin = async () => {
    setIsJoiningRoom(true);
    try {
      console.log('MAIN: handleQuickJoin - Looking for available rooms...');
      
      toast({ title: "Quick Join", description: "Looking for available rooms..." });
      
      // Find an available room
      const roomCode = await findAvailableRoomForQuickJoin();
      
      if (!roomCode) {
        toast({ 
          title: "No Available Rooms", 
          description: "No public rooms are currently available. Try creating a new room!", 
          variant: "destructive" 
        });
        return;
      }
      
      console.log(`MAIN: handleQuickJoin - Found available room: ${roomCode}`);
      
      // Use the existing handleJoinRoom logic to join the found room
      await handleJoinRoom(roomCode);
      
    } catch (error: any) {
      console.error('MAIN: handleQuickJoin - Error:', error.message);
      toast({ 
        title: "Quick Join Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const renderContent = () => {
    // CRITICAL: Check reset flag first - always show menu during reset regardless of game state
    const resetFlag = typeof window !== 'undefined' ? localStorage.getItem('gameResetFlag') : null;
    if (resetFlag === 'true') {
      console.log('LOBBY: renderContent - Reset flag active, forcing menu display');
      return (
        <MainMenu
          onCreateRoom={() => setIsCreateRoomModalOpen(true)}
          onJoinByCode={() => setIsJoinRoomModalOpen(true)}
          onBrowseRooms={() => setIsRoomBrowserModalOpen(true)}
          onQuickJoin={handleQuickJoin}
          onResetGame={handleResetGameWithPin}
        />
      );
    }
    
    // Show loading overlay during game transitions
    if (internalGameState?.transitionState && internalGameState.transitionState !== 'idle') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="h-16 w-16 animate-spin text-white mb-4 mx-auto" />
            <h2 className="text-2xl text-white font-bold">Starting Game...</h2>
            <p className="text-white/80">{internalGameState.transitionMessage || 'Preparing your cards...'}</p>
          </div>
        </div>
      );
    }
    
    // Show loading only if we're initializing a game (e.g., from room code URL)
    if (isInitializing) {
      return <div className="flex-grow flex items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>;
    }
    
    // If no game state and not initializing, show welcome/menu flow
    if (!internalGameState || !internalGameState.gameId) {
      // Show welcome screen or menu based on step parameter
      if (currentStep === 'menu') {
        return (
          <MainMenu
            onCreateRoom={() => setIsCreateRoomModalOpen(true)}
            onJoinByCode={() => setIsJoinRoomModalOpen(true)}
            onBrowseRooms={() => setIsRoomBrowserModalOpen(true)}
            onQuickJoin={handleQuickJoin}
            onResetGame={handleResetGameWithPin}
          />
        );
      }
      
      // Default to welcome screen
      return (
        <div className="relative flex-grow flex flex-col bg-black">
          <Image src="/backgrounds/mobile-background.jpg" alt="Make It Terrible background" fill className="poster-image" priority data-ai-hint="game poster" />
          <div className="relative z-10 flex flex-grow items-center justify-center">
            <button onClick={() => router.push('/?step=menu')} className="group animate-slow-scale-pulse" data-testid="enter-chaos-button">
              <Image src="/ui/enter-the-chaos-button.png" alt="Enter the Chaos" width={252} height={95} className="object-contain drop-shadow-xl" data-ai-hint="chaos button" priority />
            </button>
          </div>
        </div>
      );
    }

    // If we have a game state, show the lobby/setup regardless of step parameter
    if (internalGameState.gamePhase === 'lobby') {
        if (!thisPlayer) {
          console.log("LOBBY: Rendering PWAGameLayout for new player setup.");
          return <PWAGameLayout gameId={internalGameState.gameId} onPlayerAdded={handlePlayerAdded} />;
        }
  
        const hostPlayerId = internalGameState.ready_player_order.length > 0 ? internalGameState.ready_player_order[0] : null;
        const enoughPlayers = internalGameState.players.length >= MIN_PLAYERS_TO_START;
        const allPlayersReady = enoughPlayers && internalGameState.players.every(p => p.isReady);
        const showStartGameButton = thisPlayer.id === hostPlayerId && enoughPlayers && allPlayersReady;

        console.log("LOBBY: Rendering main lobby view.");
        return (
          <LobbyLayout onOpenMenu={() => setIsMenuModalOpen(true)}>
            <LobbyPlayerList
              players={sortedPlayersForDisplay}
              thisPlayer={thisPlayer}
              onToggleReady={handleToggleReady}
              isProcessingAction={isProcessingAction}
            />
            <div className="flex-shrink-0">
              <LobbyStatusMessage
                players={internalGameState.players}
                hostPlayerId={hostPlayerId}
                thisPlayerId={thisPlayer?.id || null}
                showStartGameButton={showStartGameButton}
              />
              <LobbyStartButton
                showStartButton={showStartGameButton}
                isProcessingAction={isProcessingAction}
                onStartGame={handleStartGame}
              />
            </div>
          </LobbyLayout>
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
              <Button onClick={handleResetGameWithPin} variant="destructive" className="mt-6" disabled={isProcessingAction}>{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Reset Game (Testing)</Button>
            </div>
          </div>
        );
      }
    
    // If we get here, there's some other game phase or condition
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
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
            variant="outline"
            onClick={() => {
              window.open('https://forms.gle/vj3Z9NnyGrQ1yf737', '_blank');
              setIsMenuModalOpen(false);
            }}
            className="bg-black/10 hover:bg-black/20 text-black border-black/30"
          >
            <Edit className="mr-2 h-4 w-4" /> User Submissions
          </Button>
          {(process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.search.includes('dev'))) && (
            <Button 
              variant="outline" 
              onClick={() => {
                setIsMenuModalOpen(false);
                setIsDevConsoleOpen(true);
              }}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 border-blue-500/30"
            >
              <Terminal className="mr-2 h-4 w-4" /> Dev Console
            </Button>
          )}
          <Button
            onClick={() => {
              setIsMenuModalOpen(false);
              handleResetGameWithPin();
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

      {/* PIN Code Modal */}
      <PinCodeModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handleResetGame}
        title="Enter PIN to Reset Game"
      />

      {/* Dev Console Modal */}
      <DevConsoleModal
        isOpen={isDevConsoleOpen}
        onClose={() => setIsDevConsoleOpen(false)}
        gameState={internalGameState}
        thisPlayer={thisPlayer}
      />

      {/* Room Management Modals */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        isCreating={isCreatingRoom}
      />

      <JoinRoomModal
        isOpen={isJoinRoomModalOpen}
        onClose={() => setIsJoinRoomModalOpen(false)}
        onJoinRoom={handleJoinRoom}
        isJoining={isJoiningRoom}
        initialRoomCode={roomCodeParam || ''}
      />

      <RoomBrowserModal
        isOpen={isRoomBrowserModalOpen}
        onClose={() => setIsRoomBrowserModalOpen(false)}
        onJoinRoom={handleJoinRoom}
        isJoining={isJoiningRoom}
      />
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

// Force dynamic rendering to avoid SSR issues with contexts

