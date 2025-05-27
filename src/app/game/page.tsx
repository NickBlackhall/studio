import { redirect } from 'next/navigation';
import { getGame, startGame, selectCategory, submitResponse, selectWinner, nextRound } from '@/app/game/actions';
import type { GameState, Player } from '@/lib/types';
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertTriangle, Home, Play } from 'lucide-react';
import Image from 'next/image';

// For simplicity, we'll assume a single "session" for the current player.
// In a real multi-user app, you'd need authentication and ways to identify the current user.
// Here, we'll just pick the first player as "this client's player" if no better mechanism.
// This is a placeholder for player session management.
async function getThisPlayersId(players: Player[]): Promise<string | null> {
  // This logic is naive. In a real app, this would come from auth/session.
  // If there are players, return the ID of the most recently added one,
  // assuming that's the one who just joined from the welcome page.
  if (players.length > 0) {
    return players[players.length - 1].id;
  }
  return null;
}


export default async function GamePage() {
  const gameState = await getGame();

  if (!gameState || gameState.players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full text-center py-12">
        <Image src="https://placehold.co/150x150.png?text=Uh+Oh!" alt="Error" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="error warning"/>
        <h1 className="text-4xl font-bold text-destructive mb-4">Game Not Found or No Players!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          It looks like the game hasn't started or there are no players.
        </p>
        <Link href="/">
          <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Welcome Page
          </Button>
        </Link>
      </div>
    );
  }
  
  // If game is in welcome or waiting_for_players and not enough players, redirect.
  // This might happen if a user navigates directly to /game
  if ((gameState.gamePhase === 'welcome' || gameState.gamePhase === 'waiting_for_players') && gameState.players.length < 2) {
     redirect('/');
  }

  // If game is waiting and has enough players, but not started, provide a start button
  if (gameState.gamePhase === 'waiting_for_players' && gameState.players.length >= 2) {
    // The "Start Game" action needs to be callable. We can use a form for this.
    const handleStartGame = async () => {
        "use server";
        await startGame();
    };
    return (
         <div className="flex flex-col items-center justify-center min-h-full text-center py-12">
            <Image src="https://placehold.co/150x150.png?text=Ready%3F" alt="Ready to play" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="game start"/>
            <h1 className="text-4xl font-bold text-primary mb-4">Ready to Make it Terrible?</h1>
            <p className="text-lg text-muted-foreground mb-8">
            {gameState.players.length} players are in the lobby. Let the chaos begin!
            </p>
            <form action={handleStartGame}>
                <Button type="submit" variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
                    <Play className="mr-2 h-6 w-6" /> Start Game Now!
                </Button>
            </form>
            <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        </div>
    );
  }


  const thisPlayerId = await getThisPlayersId(gameState.players);
  // If for some reason we can't identify this player in a game that has started, it's an issue.
  if (!thisPlayerId && gameState.gamePhase !== 'welcome' && gameState.gamePhase !== 'waiting_for_players') {
     // This could happen if a player joins, game starts, then they refresh and we lose their "session"
     // Redirect to home for now.
     redirect('/');
  }
  
  const currentPlayer = gameState.players.find(p => p.id === thisPlayerId);

  // If the identified player is not in the game state (e.g. they were removed, or error), redirect.
  // Allow if game is over or in winner announcement for spectating.
  if (!currentPlayer && gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over') {
    console.warn("Current player not found in game state. Redirecting to home.");
    redirect('/');
  }


  const isJudge = currentPlayer?.id === gameState.currentJudgeId;

  const renderGameContent = () => {
    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      return <WinnerDisplay gameState={gameState} onNextRound={nextRound} />;
    }
    if (isJudge && currentPlayer) {
      return <JudgeView gameState={gameState} judge={currentPlayer} onSelectCategory={selectCategory} onSelectWinner={selectWinner} />;
    }
    if (!isJudge && currentPlayer) {
      return <PlayerView gameState={gameState} player={currentPlayer} onSubmitResponse={(cardText) => submitResponse(currentPlayer.id, cardText)} />;
    }
    // Fallback for spectators or if player role can't be determined but game is ongoing (should ideally not happen with current logic)
    return (
        <Card className="text-center">
            <CardHeader><CardTitle>Spectating</CardTitle></CardHeader>
            <CardContent><p>The game is in progress. Current phase: {gameState.gamePhase}</p></CardContent>
        </Card>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 py-8 max-w-7xl mx-auto">
      <aside className="w-full md:w-1/3 lg:w-1/4">
        <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Round {gameState.currentRound}</p>
          <Link href="/" className="mt-2 inline-block">
            <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
              <Home className="mr-1 h-4 w-4" /> Exit Game (Not Advised)
            </Button>
          </Link>
        </div>
      </aside>
      <main className="flex-grow w-full md:w-2/3 lg:w-3/4">
        {renderGameContent()}
      </main>
    </div>
  );
}
