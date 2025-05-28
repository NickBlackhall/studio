
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import PlayerSetupForm from '@/components/game/PlayerSetupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { getGame, addPlayer as addPlayerAction, resetGameForTesting } from '@/app/game/actions'; // Temporarily remove
import { Users, Play, ArrowRight, RefreshCw } from 'lucide-react';
// import type { GameState } from '@/lib/types'; // Temporarily remove
import CurrentYear from '@/components/CurrentYear';

export const dynamic = 'force-dynamic';

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // const game: GameState = await getGame(); // Temporarily comment out

  const handleAddPlayer = async (formData: FormData) => {
    "use server";
    const name = formData.get('name') as string;
    const avatar = formData.get('avatar') as string;
    if (name && avatar) {
      // await addPlayerAction(name, avatar); // Temporarily comment out
      console.log("Simulating add player:", name, avatar);
    }
  };

  const handleResetGame = async () => {
    "use server";
    // await resetGameForTesting(); // Temporarily comment out
    console.log("Simulating reset game");
  };

  if (searchParams?.step === 'setup') {
    // Player Setup and Lobby View
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground">
        <header className="mb-12 text-center">
          <Link href="/" passHref>
            <Image
              src="https://placehold.co/300x90.png?text=Logo" 
              alt="Make It Terrible Logo"
              width={300}
              height={90}
              className="mx-auto mb-4 rounded-lg cursor-pointer shadow-md"
              data-ai-hint="game logo"
              priority
            />
          </Link>
          <h1 className="text-5xl font-extrabold tracking-tighter text-primary sr-only">Make It Terrible</h1>
          <p className="text-xl text-muted-foreground mt-2">Enter your details to join the game.</p>
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
              {/* {game.players.length > 0 ? ( // Temporarily removed
                <ul className="space-y-3">
                  {game.players.map((player) => (
                    <li key={player.id} className="flex items-center p-3 bg-muted rounded-lg shadow">
                      <span className="text-4xl mr-4">{player.avatar}</span>
                      <span className="text-xl font-medium text-foreground">{player.name}</span>
                    </li>
                  ))}
                </ul>
              ) : ( */}
                <p className="text-muted-foreground text-center py-4">Player list temporarily disabled.</p>
              {/* )} */}
              {/* {game.players.length >= 2 && ( // Temporarily removed
                <Link href="/game" className="mt-6 block">
                  <Button variant="default" size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg font-semibold py-3">
                    <Play className="mr-2 h-6 w-6" /> Start Game
                  </Button>
                </Link>
              )}
               {game.players.length < 2 && game.players.length > 0 && ( // Temporarily removed
                 <p className="text-sm text-center mt-4 text-muted-foreground">Need at least 2 players to start the game.</p>
               )} */}
               <p className="text-sm text-center mt-4 text-muted-foreground">Start game logic temporarily disabled.</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 w-full max-w-4xl text-center">
          <form action={handleResetGame}>
            <Button variant="destructive" size="sm" type="submit" className="hover:bg-destructive/80">
              <RefreshCw className="mr-2 h-4 w-4" /> Reset Game State (For Testing)
            </Button>
          </form>
        </div>

         <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
        </footer>
      </div>
    );
  }

  // Default: Welcome/Entrance Screen
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 bg-background text-foreground text-center">
      <Image
        src="https://placehold.co/438x131.png?text=Logo" 
        alt="Make It Terrible Logo"
        width={438}
        height={131}
        className="mx-auto mb-8 rounded-lg shadow-md"
        priority
        data-ai-hint="game logo"
      />
      <h1 className="text-6xl font-extrabold tracking-tighter text-primary mb-4 sr-only">
        Make It Terrible
      </h1>
      <p className="text-2xl text-muted-foreground mb-12">
        The game of awful choices and hilarious outcomes!
      </p>
      <Link href="/?step=setup">
        <Button variant="default" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-2xl px-10 py-8 font-bold shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out">
          Join the Mayhem <ArrowRight className="ml-3 h-7 w-7" />
        </Button>
      </Link>
       <footer className="absolute bottom-8 text-center text-sm text-muted-foreground w-full">
        <p>&copy; <CurrentYear /> Make It Terrible Inc. All rights reserved (not really).</p>
      </footer>
    </div>
  );
}
