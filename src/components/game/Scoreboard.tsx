
"use client";

import type { Player } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Award, Gavel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ScoreboardProps {
  players: Player[];
  currentJudgeId: string | null;
  defaultOpen?: boolean; // New prop
}

const ScoreboardContentDisplay = ({ players, currentJudgeId }: Omit<ScoreboardProps, 'defaultOpen'>) => (
  <div className="p-4 space-y-3">
    {players.map((player, index) => (
      <div
        key={player.id}
        className={cn(
          `flex items-center justify-between p-3 rounded-md shadow-sm transition-all duration-300 ease-in-out`,
          player.id === currentJudgeId ? 'bg-accent/20 border-2 border-accent' : 'bg-background hover:bg-muted/30',
          index === 0 && player.score > 0 ? 'border-yellow-400 border-l-4 pl-2' : 'border border-transparent'
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
            />
          ) : (
            <span className="text-3xl mr-3">{player.avatar}</span>
          )}
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
  </div>
);


export default function Scoreboard({ players, currentJudgeId, defaultOpen = false }: ScoreboardProps) {
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

  if (defaultOpen) {
    return (
      <div className="w-full border-2 border-muted rounded-xl overflow-hidden shadow-lg bg-card">
        <div className="px-4 py-3 bg-muted/50 flex items-center text-2xl font-bold text-foreground">
          <Award className="mr-2 h-6 w-6 text-accent" />
          Scoreboard
        </div>
        <ScoreboardContentDisplay players={sortedPlayers} currentJudgeId={currentJudgeId} />
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
      <AccordionItem value="item-1" className="border-2 border-muted rounded-xl overflow-hidden shadow-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/50 data-[state=open]:border-b data-[state=open]:border-muted">
          <div className="flex items-center text-2xl font-bold text-foreground">
            <Award className="mr-2 h-6 w-6 text-accent" />
            Scoreboard
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-0">
         <ScoreboardContentDisplay players={sortedPlayers} currentJudgeId={currentJudgeId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
