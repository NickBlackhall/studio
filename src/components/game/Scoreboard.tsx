
"use client";

import type { Player } from '@/lib/types';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface ScoreboardProps {
  players: Player[];
  currentJudgeId: string | null;
}

export default function Scoreboard({ players, currentJudgeId }: ScoreboardProps) {
  if (!players || players.length === 0) {
    return (
      <div className="p-4 text-center text-white">
        No players in game.
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
    <div className="w-full h-full text-black overflow-y-auto scrollbar-hide">
      <ul className="space-y-3">
        {sortedPlayers.map((player) => (
          <li key={player.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Image
                src={player.avatar}
                alt={`${player.name}'s avatar`}
                width={48}
                height={48}
                className="rounded-md object-contain flex-shrink-0"
                data-ai-hint="player avatar"
              />
              <div className="flex items-center gap-2 min-w-0 border-2 border-red-500 mt-1">
                <span className="font-im-fell text-2xl font-bold truncate">{player.name}</span>
                {player.id === currentJudgeId && (
                   <Badge className="bg-[#d93736] text-white font-corben text-[10px] border-2 border-black -rotate-6 shadow-md px-1.5 py-0">
                    JUDGE
                   </Badge>
                )}
              </div>
            </div>
            <span className="font-corben text-4xl font-bold flex-shrink-0">{player.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
