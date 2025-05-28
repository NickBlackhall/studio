
import { redirect } from 'next/navigation';
import { getGame, startGame, selectCategory, submitResponse, selectWinner, nextRound } from '@/app/game/actions';
import type { GameClientState, PlayerClientState } from '@/lib/types'; // Updated Player to PlayerClientState
import Scoreboard from '@/components/game/Scoreboard';
import JudgeView from '@/components/game/JudgeView';
import PlayerView from '@/components/game/PlayerView';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Home, Play } from 'lucide-react'; // Removed AlertTriangle for now
import Image from 'next/image';

// For simplicity, we'll assume a single "session" for the current player.
// In a real multi-user app, you'd need authentication and ways to identify the current user.
// Here, we'll just pick the first player as "this client's player" if no better mechanism.
// This is a placeholder for player session management.
async function getThisPlayersId(players: PlayerClientState[]): Promise<string | null> {
  // This logic is naive. In a real app, this would come from auth/session.
  // For now, if localStorage has a playerId that's in the current game's players, use that.
  // Otherwise, if players exist, return the ID of the most recently added one by created_at
  // (This part would require created_at on PlayerClientState or fetching players ordered by created_at)
  // For simplicity, let's just return the last player in the array for now.
  if (typeof window !== 'undefined') {
    const storedPlayerId = localStorage.getItem('thisPlayerId');
    if (storedPlayerId && players.some(p => p.id === storedPlayerId)) {
      return storedPlayerId;
    }
  }
  if (players.length > 0) {
    // This is still naive for multi-tab scenarios on same browser without better session management.
    // A better approach would be to set localStorage when a player is successfully added by a client.
    return players[players.length - 1].id;
  }
  return null;
}


export default async function GamePage() {
  const gameState = await getGame();

  if (!gameState || !gameState.gameId) {
    // This means findOrCreateGame might have failed critically or returned unexpected null
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="https://placehold.co/150x150.png?text=Uh+Oh!" alt="Error" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="error warning"/>
        <h1 className="text-4xl font-bold text-destructive mb-4">Critical Game Error!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Could not load or initialize the game session. Please try again.
        </p>
        <Link href="/">
          <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/80 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Welcome Page
          </Button>
        </Link>
      </div>
    );
  }
  
  if (gameState.players.length === 0 && gameState.gamePhase === 'lobby') {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
        <Image src="https://placehold.co/150x150.png?text=Empty!" alt="Empty Lobby" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="empty lobby"/>
        <h1 className="text-4xl font-bold text-primary mb-4">Lobby is Empty!</h1>
        <p className="text-lg text-muted-foreground mb-8">
          No players have joined the game yet. Head to the welcome page to join!
        </p>
        <Link href="/">
          <Button variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg">
            <Home className="mr-2 h-5 w-5" /> Go to Welcome Page
          </Button>
        </Link>
      </div>
    );
  }


  // If game is in 'lobby' (previously 'waiting_for_players') and not enough players, redirect to home.
  // This might happen if a user navigates directly to /game and no one has started.
  if (gameState.gamePhase === 'lobby' && gameState.players.length < 2) {
     redirect('/?step=setup'); // Redirect to setup, they can join from there
  }

  // If game is waiting and has enough players, but not started, provide a start button
  // This button now calls the startGame server action
  if (gameState.gamePhase === 'lobby' && gameState.players.length >= 2) {
    return (
         <div className="flex flex-col items-center justify-center min-h-screen text-center py-12">
            <Image src="https://placehold.co/150x150.png?text=Ready%3F" alt="Ready to play" width={150} height={150} className="mb-6 rounded-lg shadow-md" data-ai-hint="game start"/>
            <h1 className="text-4xl font-bold text-primary mb-4">Ready to Make it Terrible?</h1>
            <p className="text-lg text-muted-foreground mb-8">
            {gameState.players.length} players are in the lobby. Let the chaos begin!
            </p>
            {/* Form action now correctly calls startGame with the gameId */}
            <form action={async () => {
                "use server";
                if (gameState.gameId) {
                    await startGame(gameState.gameId);
                } else {
                    console.error("startGame action on GamePage: gameId is missing from gameState.");
                }
            }}>
                <Button type="submit" variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xl px-8 py-6">
                    <Play className="mr-2 h-6 w-6" /> Start Game Now!
                </Button>
            </form>
            <Scoreboard players={gameState.players} currentJudgeId={gameState.currentJudgeId} />
        </div>
    );
  }


  const thisPlayerId = await getThisPlayersId(gameState.players);
  
  if (!thisPlayerId && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
     console.warn("GamePage: Could not determine current player. Redirecting to home.");
     redirect('/');
  }
  
  const currentPlayer = gameState.players.find(p => p.id === thisPlayerId);

  if (!currentPlayer && (gameState.gamePhase !== 'winner_announcement' && gameState.gamePhase !== 'game_over')) {
    console.warn("GamePage: Current player data not found in game state. Redirecting to home.");
    redirect('/');
  }


  const isJudge = currentPlayer?.id === gameState.currentJudgeId;

  const renderGameContent = () => {
    if (gameState.gamePhase === 'winner_announcement' || gameState.gamePhase === 'game_over') {
      // Pass the full gameState to WinnerDisplay
      return <WinnerDisplay gameState={gameState} onNextRound={() => nextRound(gameState.gameId)} />;
    }
    if (isJudge && currentPlayer) {
      // Pass the full gameState to JudgeView
      return <JudgeView gameState={gameState} judge={currentPlayer} onSelectCategory={(categoryId) => selectCategory(gameState.gameId, categoryId)} onSelectWinner={(cardText) => selectWinner(cardText, gameState.gameId)} />;
    }
    if (!isJudge && currentPlayer) {
      // Pass the full gameState to PlayerView
      return <PlayerView gameState={gameState} player={currentPlayer} />;
    }
    // Fallback for spectators or if player role can't be determined
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
              <Home className="mr-1 h-4 w-4" /> Exit Game
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

// Add export const dynamic for Server Components that need dynamic rendering
export const dynamic = 'force-dynamic';
