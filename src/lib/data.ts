import type { ScenarioClientState as Scenario } from "./types";

// Generate paths for avatar1.png through avatar21.png
export const AVATARS: string[] = Array.from({ length: 21 }, (_, i) => `/ui/avatar${i + 1}.png?v=2`);

export const CATEGORIES: string[] = [
  "Pop Culture and Internet",
  "Super Powers",
  "R-Rated",
  "Life Things",
  "Absurd and Surreal"
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
