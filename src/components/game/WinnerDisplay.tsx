
"use client";

import type { GameClientState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import Image from 'next/image';

interface WinnerDisplayProps {
  gameState: GameClientState;
  onPlayAgainYes: () => Promise<void>; 
  onPlayAgainNo: () => void; 
}

export default function WinnerDisplay({ gameState, onPlayAgainYes, onPlayAgainNo }: WinnerDisplayProps) {
  const [isYesPending, startYesTransition] = useTransition();
  const [isNoPending, startNoTransition] = useTransition();

  const overallWinner = gameState.winningPlayerId ? gameState.players.find(p => p.id === gameState.winningPlayerId) : null;

  const renderAvatar = (avatarPath: string | null | undefined, playerName: string) => {
    if (avatarPath && avatarPath.startsWith('/')) {
      return (
        <Image
          src={avatarPath}
          alt={`${playerName}'s avatar`}
          width={48}
          height={48}
          className="inline-block rounded-md object-contain mr-2 align-middle"
          data-ai-hint="player avatar"
        />
      );
    }
    return <span className="text-3xl mr-2 align-middle">{avatarPath || '🤔'}</span>;
  };

  if (gameState.gamePhase !== 'game_over' || !overallWinner) {
    // This component now only handles game_over. If not game_over, or no winner, render nothing or a fallback.
    // For now, returning null as GamePage will handle showing the RoundWinnerModal or this.
    return null; 
  }

  return (
    <Card className="text-center shadow-xl border-4 border-yellow-400 rounded-xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 text-black">
      <CardHeader className="p-8">
        <Trophy className="h-24 w-24 mx-auto text-yellow-700 mb-4" />
        <CardTitle className="text-5xl font-extrabold">GAME OVER!</CardTitle>
        <CardDescription className="text-3xl font-semibold mt-2 text-yellow-800 flex items-center justify-center">
          {renderAvatar(overallWinner.avatar, overallWinner.name)}
          {overallWinner.name} is the Grand Champion of Terribleness!
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <p className="text-xl mb-2">Congratulations on achieving peak terribleness with {overallWinner.score} points!</p>
        <p className="text-xl font-semibold mb-4">Play Again?</p>
        <div className="flex justify-center gap-4">
          <Button 
            onClick={() => startYesTransition(async () => await onPlayAgainYes())} 
            disabled={isYesPending || isNoPending} 
            size="lg" 
            className="bg-green-500 hover:bg-green-600 text-white text-lg font-semibold py-3 px-6"
          >
            {isYesPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
            Yes!
          </Button>
          <Button 
            onClick={onPlayAgainNo} 
            disabled={isNoPending || isYesPending} 
            size="lg" 
            variant="destructive"
            className="bg-red-500 hover:bg-red-600 text-white text-lg font-semibold py-3 px-6"
          >
            {isNoPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />} 
            No
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
