import type { Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Gavel, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ScoreboardProps {
  players: Player[];
  currentJudgeId: string | null;
}

export default function Scoreboard({ players, currentJudgeId }: ScoreboardProps) {
  if (!players || players.length === 0) {
    return null;
  }

  // Sort players by score descending, then by name
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score === a.score) {
      return a.name.localeCompare(b.name);
    }
    return b.score - a.score;
  });


  return (
    <Card className="shadow-lg border-2 border-muted rounded-xl">
      <CardHeader className="bg-muted/50 p-4">
        <CardTitle className="text-2xl font-bold text-foreground flex items-center">
          <Award className="mr-2 h-6 w-6 text-accent" />
          Scoreboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-md shadow transition-all duration-300 ease-in-out
              ${player.id === currentJudgeId ? 'bg-accent/20 border-2 border-accent' : 'bg-background hover:bg-muted/30'}
              ${index === 0 ? 'border-yellow-400 border-l-4' : ''}
            `}
          >
            <div className="flex items-center">
              <span className="text-3xl mr-3">{player.avatar}</span>
              <div>
                <span className="text-lg font-semibold text-foreground">{player.name}</span>
                {player.id === currentJudgeId && (
                  <Badge variant="secondary" className="ml-2 bg-secondary text-secondary-foreground">
                    <Gavel className="mr-1 h-3 w-3" /> Judge
                  </Badge>
                )}
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{player.score} pts</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
