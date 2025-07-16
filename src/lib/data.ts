
import type { ScenarioClientState as Scenario } from "./types";

// Generate paths for avatar1.png through avatar22.png
export const AVATARS: string[] = Array.from({ length: 22 }, (_, i) => `/ui/avatar${i + 1}.png?v=3`);

export const CATEGORIES: string[] = [
  "Pop Culture and Internet",
  "Super Powers",
  "R-Rated",
  "Life Things",
  "Absurd and Surreal"
];

// Boondoggles are short, physical or verbal challenges.
export const BOONDOGGLE_CHALLENGES: string[] = [
  "Strike the most ridiculous pose. The judge will decide who holds it the longest and most majestically.",
  "Without using words, act out a famous movie scene. First person the judge recognizes wins.",
  "Tell the best one-sentence joke. The one that makes the judge groan the loudest wins.",
  "Give everyone at the table a new, terrible nickname. The judge picks the 'best' one.",
  "Best impression of a famous person (you choose who). The judge decides who is the most convincing.",
  "Name 5 things that are definitely NOT in your pocket right now. First to list five wins.",
  "The floor is lava. The last person to get their feet off the floor loses this challenge for everyone else.",
  "The first person to bring the judge a spoon wins a point. GO!",
  "Make the weirdest noise you can with your mouth. The judge's favorite sound wins.",
  "Talk for 30 seconds about a completely boring topic (like beige paint) without pausing or saying 'um'. Judge decides the best.",
  "Create a secret handshake with the person to your left. The judge will rate the handshake's creativity.",
  "Best air guitar solo to a song the judge hums. Rock on!",
  "Invent a new dance move. The judge will pick the one with the most potential to go viral.",
  "Balance a coaster (or your phone) on your head. Last person with it still balanced wins.",
  "The judge is a monarch. Address them as such and give them your most pitiful plea for a single point.",
  "In your best movie trailer voice, dramatically describe the object to your right.",
  "Silently and dramatically recreate the story of the Three Little Pigs. Judge's favorite performance wins.",
  "First person to find something blue and touch their nose with it wins.",
  "Recite the alphabet backwards. Fastest and most accurate wins.",
  "Best celebrity impersonation. Judge's call.",
  "Arm wrestle the person to your right. Winner gets the point.",
  "The judge will name an animal. Everyone must make that animal's sound. Best one wins.",
  "Staring contest with the judge. If you make the judge blink, you win.",
  "Compliment the judge in the most creative, over-the-top way possible.",
  "Build the tallest possible tower using only items currently on the table. Judge's decision is final.",
  "Tell a story that starts with 'So, there I was...' and ends with '...and that's how I got this scar.' Best story wins.",
  "First person to stand up and shout 'I'm the king of the world!' wins.",
  "Write a haiku about the game on your phone or a piece of paper. Best one wins.",
  "Everyone must try to make the judge laugh without talking. First to succeed wins.",
  "Best evil laugh. The one that truly chills the judge's bones wins."
];

export const SCENARIOS_DATA: Record<string, string[]> = {
  "Pop Culture and Internet": [
    "You have to explain a viral TikTok trend to your grandparents. How do you make it as confusing as possible?",
    "What's the worst possible #ad to post on your Instagram?",
    "You get to create a new Netflix show. What's the title and one-sentence pitch?",
    "Describe the most terrible influencer apology video.",
    "You're a contestant on a reality show. What's your catchphrase?"
  ],
  "Super Powers": [
    "You can talk to animals, but they all hate you. How does this play out?",
    "You can turn invisible, but only when no one is looking. What's the downside?",
    "You can fly, but only at a snail's pace. How is this terrible?",
    "You have super strength, but only in your pinky toes. What's the problem?",
    "You can teleport, but only to places you've already been in the last 5 minutes."
  ],
  "R-Rated": [
    "What's the worst thing to whisper to someone during a hug?",
    "Describe a terrible pickup line that somehow works.",
    "You're making a new horror movie. What's the terrible, non-scary monster?",
    "What's the most inappropriate thing to bring to a potluck?",
    "How do you ruin a wedding with just one sentence?"
  ],
  "Life Things": [
    "What's the worst way to assemble IKEA furniture?",
    "You have to parallel park in front of a huge crowd. How do you fail spectacularly?",
    "Describe the most passive-aggressive note you could leave for a roommate.",
    "You're stuck in an elevator with your boss. What's the worst conversation starter?",
    "How do you terribly 'fix' a clogged toilet at a friend's house?"
  ],
  "Absurd and Surreal": [
    "A flock of sentient chairs is chasing you. What's their demand?",
    "You wake up and your hands have been replaced with baguettes. What's for breakfast?",
    "The sky turns plaid. How does the world react?",
    "You discover a button that, when pressed, makes a random person nearby quack like a duck. How do you use this power for evil?",
    "Your shadow has started giving you terrible life advice. What's its latest suggestion?"
  ]
};

export const RESPONSE_CARDS_DATA: string[] = [
  "Blame it on the dog.",
  "Start a flash mob.",
  "Pretend to be a mannequin.",
  "Aggressively make eye contact.",
  "Burst into interpretive dance.",
  "Fake a heart attack.",
  "Run away screaming.",
  "Offer them a half-eaten sandwich.",
  "Start speaking in a fake accent.",
  "Challenge them to a duel.",
  "Recite Shakespeare badly.",
  "Propose marriage.",
  "Over-enthusiastically agree with everything.",
  "A single, mournful kazoo note.",
  "Release the swarm of bees you carry for emergencies.",
  "Politely decline, then steal their shoes.",
  "Do the worm.",
  "Begin to narrate their life in a David Attenborough voice.",
  "Assert your dominance by T-posing.",
  "Suddenly remember a very important appointment with your imaginary friend.",
  "Spill your own drink on yourself in solidarity.",
  "Compliment their terrible fashion sense.",
  "Ask if they've ever considered competitive cheese sculpting.",
  "A full-throated yodel.",
  "Start a slow clap that never quite catches on.",
  "Reveal your 'true form'.",
  "Try to pay with Monopoly money.",
  "Demand to speak to the manager of the situation.",
  "Casually light a small, contained fire.",
  "Moonwalk out of the room.",
  "Just stare blankly.",
  "A dramatic, tearful confession of a minor crime.",
  "Start an impromptu philosophy lecture.",
  "Uncontrollable, maniacal laughter.",
  "Break out the emergency sock puppets.",
  "Try to sell them a timeshare.",
  "Explain the entire plot of a terrible movie.",
  "Insist that you are, in fact, a figment of their imagination.",
  "Offer unsolicited tax advice.",
  "A series of confused grunts.",
  "Immediately start a cult.",
  "Ask for their Wi-Fi password in a dire situation.",
  "Pull out a banjo and start strumming.",
  "Challenge them to a thumb war, right then and there.",
  "Begin to levitate slightly, then act like nothing happened.",
  "Start juggling nearby objects, poorly.",
  "Declare it's 'opposite day'.",
  "Try to communicate only through charades.",
  "Offer a confusing riddle with no answer.",
  "Hand them a participation trophy for existing."
];

export const getShuffledDeck = (cards: string[]): string[] => {
  return [...cards].sort(() => Math.random() - 0.5);
};

export const generateScenarios = (): Record<string, Scenario[]> => {
  const scenarios: Record<string, Scenario[]> = {};
  for (const category in SCENARIOS_DATA) {
    scenarios[category] = SCENARIOS_DATA[category].map((text, index) => ({
      id: `${category.replace(/\s+/g, '-').toLowerCase()}-${index}`,
      category,
      text
    }));
  }
  return scenarios;
};
