
"use client";

import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { POINTS_TO_WIN, MIN_PLAYERS_TO_START, CARDS_PER_HAND } from '@/lib/types';

export default function HowToPlayModalContent() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-3xl font-bold text-primary">How to Play: Make It Terrible!</DialogTitle>
        <DialogDescription className="text-base text-muted-foreground">
          Get ready for a game of awful choices and hilarious outcomes!
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-[65vh] sm:h-[70vh] pr-4 -mr-2">
        <div className="space-y-6 py-4 text-left text-foreground">
          <section>
            <h3 className="text-xl font-semibold text-secondary mb-2">The Goal:</h3>
            <p>
              Be the player who provides the "most terrible" (or funniest, most outrageous - it's the Judge's call!) response card to the given scenario. Earn points and be the first to reach <strong>{POINTS_TO_WIN} points</strong> to win the game!
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-secondary mb-2">Game Flow:</h3>
            <ol className="list-decimal space-y-4 pl-5">
              <li>
                <strong>Lobby & Player Setup:</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>Players join by entering a name and choosing an avatar.</li>
                  <li>Each player gets {CARDS_PER_HAND} response cards in their hand, plus a special slot to write their own.</li>
                  <li>Once at least {MIN_PLAYERS_TO_START} players have joined, everyone must click their "Ready" button.</li>
                  <li>The game starts automatically when all joined players are ready.</li>
                </ul>
              </li>
              <li>
                <strong>Round Start - Judge Assignment:</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>At the beginning of each round, one player is designated as the Judge. This role rotates sequentially among players each round.</li>
                </ul>
              </li>
              <li>
                <strong>Category Selection (Judge's Turn):</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>The Judge selects a category for the round (e.g., "Awkward Situations").</li>
                  <li>A random scenario from that category is then displayed to all players.</li>
                </ul>
              </li>
              <li>
                <strong>Player Submission (Players' Turn):</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>All players (except the Judge) review the current scenario and their hand of response cards.</li>
                  <li>Each player chooses one pre-dealt card OR writes their own custom response in the dedicated "Write your own card" slot.</li>
                  <li>Players submit their chosen card. Submissions are revealed to the Judge anonymously.</li>
                  <li>After submitting a pre-dealt card, players receive a new card to replace it.</li>
                </ul>
              </li>
              <li>
                <strong>Judging (Judge's Turn):</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>Once all players have submitted their cards, the Judge reviews all the anonymous responses.</li>
                  <li>The Judge then picks the single response card they deem the "winner" for that round (the most terrible, funny, clever, etc.).</li>
                  <li><strong>If a custom-written card wins:</strong> The Judge will be prompted to decide whether to add this new card permanently to the game's main deck.</li>
                </ul>
              </li>
              <li>
                <strong>Winner Announcement:</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>The winning response card is revealed to all players, along with the name and avatar of the player who submitted it.</li>
                  <li>The winning player is awarded 1 point, and their score is updated on the scoreboard.</li>
                </ul>
              </li>
              <li>
                <strong>Next Round / Game End:</strong>
                <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
                  <li>If no player has reached {POINTS_TO_WIN} points, the game proceeds to the next round, and the Judge role rotates.</li>
                  <li>If a player reaches {POINTS_TO_WIN} points, they are declared the overall winner, and the game ends!</li>
                </ul>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-secondary mb-2">Tips for Being Terribly Good:</h3>
            <ul className="list-disc space-y-1 pl-5 mt-1 text-sm text-muted-foreground">
              <li><strong>Know Your Judge:</strong> Tailor your submissions to their sense of humor.</li>
              <li><strong>Be Unexpected:</strong> Sometimes the most random card wins.</li>
              <li><strong>Embrace Absurdity:</strong> The more outlandish, the better!</li>
              <li><strong>Timing is Everything:</strong> A well-timed terrible joke can be a masterpiece.</li>
              <li><strong>Get Creative:</strong> Your custom-written cards might be your ticket to victory and legendary status if they make it into the main deck!</li>
            </ul>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}
