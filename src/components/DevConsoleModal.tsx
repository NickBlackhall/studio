"use client";

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PureMorphingModal } from './PureMorphingModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Lock, 
  Terminal, 
  Users, 
  Play, 
  SkipForward, 
  Crown, 
  RefreshCw,
  UserMinus,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import type { GameClientState, PlayerClientState } from '@/lib/types';
import { resetGameForTesting, removePlayerFromGame } from '@/app/game/actions';
import { useToast } from '@/hooks/use-toast';

interface DevConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameClientState | null;
  thisPlayer: PlayerClientState | null;
}

const RESET_PIN = "6425"; // Same PIN as PinCodeModal

export default function DevConsoleModal({ 
  isOpen, 
  onClose, 
  gameState,
  thisPlayer
}: DevConsoleModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  // Check if current player is the host (room creator)
  const isHost = gameState?.hostPlayerId === thisPlayer?.id;

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Small delay to prevent brute force attempts
    await new Promise(resolve => setTimeout(resolve, 500));

    if (pin === RESET_PIN) {
      setPin('');
      setError('');
      setIsSubmitting(false);
      setIsAuthenticated(true);
      toast({ title: "Dev Console Unlocked", description: "Access granted to developer tools." });
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    setIsSubmitting(false);
    setIsAuthenticated(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) { // Max 6 digits
      setPin(value);
      if (error) setError(''); // Clear error when typing
    }
  };

  const handleResetGame = async () => {
    startTransition(async () => {
      try {
        await resetGameForTesting();
        toast({ title: "Game Reset", description: "Game has been reset successfully." });
        handleClose();
      } catch (error: any) {
        toast({ 
          title: "Reset Failed", 
          description: error.message || "Failed to reset game.", 
          variant: "destructive" 
        });
      }
    });
  };

  const handleKickPlayer = async (playerToKick: PlayerClientState) => {
    if (!gameState?.gameId) return;
    
    startTransition(async () => {
      try {
        await removePlayerFromGame(gameState.gameId, playerToKick.id, 'kicked');
        toast({ 
          title: "Player Removed", 
          description: `${playerToKick.name} has been removed from the game.` 
        });
      } catch (error: any) {
        toast({ 
          title: "Kick Failed", 
          description: error.message || "Failed to remove player.", 
          variant: "destructive" 
        });
      }
    });
  };

  // Only hosts can access dev console (with fallback for development)
  // In production this component won't even be reachable due to button visibility logic
  if (!isHost && process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Show PIN entry if not authenticated
  if (!isAuthenticated) {
    return (
      <PureMorphingModal
        isOpen={isOpen}
        onClose={handleClose}
        variant="settings"
        icon="🔒"
        title="Dev Console Access"
        isDismissable={!isSubmitting}
      >
        <div className="space-y-6 p-4">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the PIN to access developer console with advanced game controls.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter PIN"
                value={pin}
                onChange={handleInputChange}
                className="text-center text-lg tracking-widest"
                maxLength={6}
                autoFocus
                disabled={isSubmitting}
              />
              {error && (
                <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !pin.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Lock className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Terminal className="mr-2 h-4 w-4" />
                    Access Console
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </PureMorphingModal>
    );
  }

  // Show dev console if authenticated
  return (
    <PureMorphingModal
      isOpen={isOpen}
      onClose={handleClose}
      variant="settings"
      icon="⚡"
      title="Developer Console"
      className="max-w-2xl"
    >
      <div className="space-y-6 p-4 max-h-96 overflow-y-auto">
        {/* Game State Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Play className="h-4 w-4 mr-2" />
              Game State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Phase:</span>
              <Badge variant="outline">{gameState?.gamePhase || 'Unknown'}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Round:</span>
              <Badge variant="outline">{gameState?.currentRound || 0}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Judge:</span>
              <Badge variant="outline">
                {gameState?.players.find(p => p.id === gameState.currentJudgeId)?.name || 'None'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Players:</span>
              <Badge variant="outline">{gameState?.players.length || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Player Management */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Player Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gameState?.players.map(player => {
              const isPlayerHost = gameState?.hostPlayerId === player.id;
              const isCurrentPlayer = player.id === thisPlayer?.id;
              
              return (
                <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">{player.name}</span>
                    {isPlayerHost && <span className="text-xs">👑</span>}
                    {player.isJudge && <Crown className="h-3 w-3 text-yellow-500" />}
                    <Badge variant="secondary" className="text-xs">{player.score} pts</Badge>
                  </div>
                  {!isCurrentPlayer && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleKickPlayer(player)}
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            }) || <p className="text-sm text-muted-foreground">No players found</p>}
          </CardContent>
        </Card>

        {/* Game Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Terminal className="h-4 w-4 mr-2" />
              Game Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                size="sm" 
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  // TODO: Implement phase controls
                  toast({ 
                    title: "Coming Soon", 
                    description: "Phase controls will be implemented next.",
                    variant: "default" 
                  });
                }}
              >
                <SkipForward className="h-3 w-3 mr-1" />
                Next Phase
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  // TODO: Implement round skip
                  toast({ 
                    title: "Coming Soon", 
                    description: "Round controls will be implemented next.",
                    variant: "default" 
                  });
                }}
              >
                <Play className="h-3 w-3 mr-1" />
                Next Round
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center text-red-600">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleResetGame}
              variant="destructive"
              size="sm"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Entire Game
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will completely reset the game and remove all players.
            </p>
          </CardContent>
        </Card>

        <div className="pt-2 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="w-full"
            disabled={isPending}
          >
            Close Console
          </Button>
        </div>
      </div>
    </PureMorphingModal>
  );
}