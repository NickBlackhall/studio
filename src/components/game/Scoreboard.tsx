
"use client";

import type { Player } from '@/lib/types';
import { Award, Gavel, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ScoreboardProps {
  players: Player[];
  currentJudgeId: string | null;
  defaultOpen?: boolean; // This prop is no longer used for accordion logic
}

const ScoreboardContentDisplay = ({ players, currentJudgeId }: Omit<ScoreboardProps, 'defaultOpen'>) => (
  <div className="bg-card text-card-foreground rounded-lg shadow-lg w-full">
    <div className="p-3 border-b border-border flex items-center text-lg font-semibold">
      <Award className="mr-2 h-5 w-5 text-yellow-500" />
      Scoreboard
    </div>
    <div className="p-2 space-y-2">
      {players.map((player, index) => (
        <div
          key={player.id}
          className={cn(
            'flex items-center justify-between p-2 rounded-md transition-all duration-300 ease-in-out',
            player.id === currentJudgeId ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-transparent',
            index === 0 && player.score > 0 ? 'border-l-4 border-yellow-400' : 'border-l-4 border-transparent'
          )}
        >
          <div className="flex items-center">
            {player.avatar.startsWith('/') ? (
              <Image
                src={player.avatar}
                alt={`${player.name}'s avatar`}
                width={36}
                height={36}
                className="mr-3 rounded-md object-cover"
                data-ai-hint="player avatar"
              />
            ) : (
              <span className="text-3xl mr-3">{player.avatar}</span>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{player.name}</span>
              {player.id === currentJudgeId && (
                <Badge variant="secondary" className="h-6">
                  <Gavel className="mr-1 h-3 w-3" /> Judge
                </Badge>
              )}
            </div>
          </div>
          <span className="text-2xl font-bold text-foreground">{player.score}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Scoreboard({ players, currentJudgeId }: ScoreboardProps) {
  if (!players || players.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No players in the game yet.
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score === a.score) {
      return a.name.localeCompare(b.name);
    }
    return b.score - a.score;
  });

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-white">
      <Trophy className="h-16 w-16 text-yellow-300 drop-shadow-lg" />
      <h2 className="text-3xl font-bold">Scoreboard</h2>
      <div className="w-full mt-2">
        <ScoreboardContentDisplay players={sortedPlayers} currentJudgeId={currentJudgeId} />
      </div>
    </div>
  );
}
