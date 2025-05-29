
"use client";

import type { GameClientState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import Image from 'next/image';

interface WinnerDisplayProps {
  gameState: GameClientState;
  onNextRound: () => Promise<void>; 
  onPlayAgainYes: () => Promise<void>;
  onPlayAgainNo: () => Promise<void>;
}

export default function WinnerDisplay({ gameState, onNextRound, onPlayAgainYes, onPlayAgainNo }: WinnerDisplayProps) {
  const [isYesPending, startYesTransition] = useTransition();
  const [isNoPending, startNoTransition] = useTransition();

  const overallWinner = gameState.winningPlayerId ? gameState.players.find(p => p.id === gameState.winningPlayerId) : null;

  const renderAvatar = (avatarPath: string, playerName: string) => {
    if (avatarPath && avatarPath.startsWith('/')) {
      return (
        <Image
          src={avatarPath}
          alt={`${playerName}'s avatar`}
          width={48} // Adjust size as needed
          height={48}
          className="inline-block rounded-md object-contain mr-2 align-middle"
        />
      );
    }
    return <span className="text-3xl mr-2 align-middle">{avatarPath}</span>; // Fallback for old emoji avatars or if path is not an image
  };

  if (gameState.gamePhase === 'game_over' && overallWinner) {
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
              onClick={() => startYesTransition(onPlayAgainYes)} 
              disabled={isYesPending || isNoPending} 
              size="lg" 
              className="bg-green-500 hover:bg-green-600 text-white text-lg font-semibold py-3 px-6"
            >
              {isYesPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              Yes!
            </Button>
            <Button 
              onClick={() => startNoTransition(onPlayAgainNo)} 
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
  
  if (gameState.gamePhase !== 'winner_announcement' || !gameState.lastWinner) {
    return null; 
  }

  const { player, cardText } = gameState.lastWinner;

  return (
    <Card className="text-center shadow-xl border-4 border-accent rounded-xl bg-gradient-to-br from-accent/80 via-accent to-accent/70 text-accent-foreground">
      <CardHeader className="p-8">
        <Sparkles className="h-16 w-16 mx-auto text-accent-foreground/80 mb-4" />
        <CardTitle className="text-4xl font-extrabold">Round Winner!</CardTitle>
        <CardDescription className="text-2xl font-semibold mt-2 text-accent-foreground/90 flex items-center justify-center">
           {renderAvatar(player.avatar, player.name)}
           {player.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <p className="text-xl">With the wonderfully terrible answer:</p>
        <blockquote className="text-2xl font-medium p-4 bg-background/20 rounded-lg border-2 border-accent-foreground/50 shadow-inner">
          "{cardText}"
        </blockquote>
        <p className="text-xl">They now have <strong className="text-3xl">{player.score}</strong> points!</p>
        <p className="text-muted-foreground/80 text-sm animate-pulse">Next round starting soon...</p>
      </CardContent>
    </Card>
  );
}
