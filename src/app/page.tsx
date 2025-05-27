
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGame, addPlayer as addPlayerAction } from '@/app/game/actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, Play } from 'lucide-react';
import Image from 'next/image';
import type { GameState } from '@/lib/types'; // Import GameState if needed for typing `game`

export default async function WelcomePage() {
  // getGame now ensures the game is initialized if it wasn't already.
  // The game variable will be of type GameState (non-nullable).
  const game: GameState = await getGame();

  const handleAddPlayer = async (formData: FormData) => {
    "use server";
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    if (name && avatar) {
      await addPlayerAction(name, avatar);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
      <header className="mb-12 text-center">
        <Image src="https://placehold.co/300x150.png?text=Make+It+Terrible" alt="Make It Terrible Logo" width={300} height={150} className="mx-auto mb-4 rounded-lg shadow-lg" data-ai-hint="game logo"/>
        <h1 className="text-6xl font-extrabold tracking-tighter text-primary">Make It Terrible</h1>
        <p className="text-xl text-muted-foreground mt-2">The game of awful choices and hilarious outcomes!</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="shadow-2xl border-2 border-primary rounded-xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-6">
            <CardTitle className="text-3xl font-bold">Join the Mayhem!</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-base">Enter your name and pick your poison (avatar).</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <PlayerSetupForm addPlayer={handleAddPlayer} />
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-2 border-secondary rounded-xl overflow-hidden">
          <CardHeader className="bg-secondary text-secondary-foreground p-6">
            <CardTitle className="text-3xl font-bold flex items-center"><Users className="mr-3 h-8 w-8" /> Players in Lobby</CardTitle>
            <CardDescription className="text-secondary-foreground/80 text-base">See who's brave enough to play.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {game.players.length > 0 ? (
              <ul className="space-y-3">
                {game.players.map((player) => (
                  <li key={player.id} className="flex items-center p-3 bg-muted rounded-lg shadow">
                    <span className="text-4xl mr-4">{player.avatar}</span>
                    <span className="text-xl font-medium text-foreground">{player.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">The void is empty... for now. Be the first!</p>
            )}
            {game.players.length >= 2 && ( // Minimum 2 players to start
              <Link href="/game" className="mt-6 block">
                <Button variant="default" size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg font-semibold py-3">
                  <Play className="mr-2 h-6 w-6" /> Start Game
                </Button>
              </Link>
            )}
             {game.players.length < 2 && (
               <p className="text-sm text-center mt-4 text-muted-foreground">Need at least 2 players to start the game.</p>
             )}
          </CardContent>
        </Card>
      </div>
       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Make It Terrible Inc. All rights reserved (not really).</p>
      </footer>
    </div>
  );
}
