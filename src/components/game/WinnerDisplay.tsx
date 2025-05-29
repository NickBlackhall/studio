
"use client";

import type { GameClientState } from '@/lib/types'; // GameState was changed to GameClientState previously
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, Forward, RotateCcw, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
// Removed useToast as it's handled by GamePage for nextRound now

interface WinnerDisplayProps {
  gameState: GameClientState; // Changed from GameState
  onNextRound: () => Promise<void>;
}

export default function WinnerDisplay({ gameState, onNextRound }: WinnerDisplayProps) {
  const [isPending, startTransition] = useTransition();

  const handleActionClick = () => {
    startTransition(async () => {
      await onNextRound();
    });
  };

  if (gameState.gamePhase === 'game_over' && gameState.winningPlayerId) {
    const overallWinner = gameState.players.find(p => p.id === gameState.winningPlayerId);
    return (
      <Card className="text-center shadow-xl border-4 border-yellow-400 rounded-xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 text-black">
        <CardHeader className="p-8">
          <Trophy className="h-24 w-24 mx-auto text-yellow-700 mb-4" />
          <CardTitle className="text-5xl font-extrabold">GAME OVER!</CardTitle>
          {overallWinner && (
            <CardDescription className="text-3xl font-semibold mt-2 text-yellow-800">
              {overallWinner.avatar} {overallWinner.name} is the Grand Champion of Terribleness!
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-8">
          <p className="text-xl mb-6">Congratulations on achieving peak terribleness with {overallWinner?.score} points!</p>
          <Button onClick={handleActionClick} disabled={isPending} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-semibold py-3 px-8">
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}
            Play Again?
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (gameState.gamePhase !== 'winner_announcement' || !gameState.lastWinner) {
    // This component should only be rendered if gamePhase is winner_announcement or game_over and relevant data exists.
    // If it's rendered in other phases or without lastWinner/winningPlayerId, it's an issue with GamePage logic.
    // console.warn("WinnerDisplay rendered in unexpected state:", gameState.gamePhase, gameState.lastWinner);
    return null; 
  }

  const { player, cardText } = gameState.lastWinner;

  return (
    <Card className="text-center shadow-xl border-4 border-accent rounded-xl bg-gradient-to-br from-accent/80 via-accent to-accent/70 text-accent-foreground">
      <CardHeader className="p-8">
        <Sparkles className="h-16 w-16 mx-auto text-accent-foreground/80 mb-4" />
        <CardTitle className="text-4xl font-extrabold">Round Winner!</CardTitle>
        <CardDescription className="text-2xl font-semibold mt-2 text-accent-foreground/90">
          {player.avatar} {player.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <p className="text-xl">With the wonderfully terrible answer:</p>
        <blockquote className="text-2xl font-medium p-4 bg-background/20 rounded-lg border-2 border-accent-foreground/50 shadow-inner">
          "{cardText}"
        </blockquote>
        <p className="text-xl">They now have <strong className="text-3xl">{player.score}</strong> points!</p>
        {/* "Next Round" button removed for automatic transition */}
        <p className="text-muted-foreground text-sm animate-pulse">Next round starting soon...</p>
      </CardContent>
    </Card>
  );
}
