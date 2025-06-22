
import type { Scenario } from "./types";

// Generate paths for avatar1.png through avatar21.png
export const AVATARS: string[] = Array.from({ length: 21 }, (_, i) => `/ui/avatar${i + 1}.png`);

export const CATEGORIES: string[] = [
  "Awkward Situations",
  "Bad Advice",
  "Terrible Inventions",
  "Horrible Dates",
  "Unfortunate Superpowers"
];

export const SCENARIOS_DATA: Record<string, string[]> = {
  "Awkward Situations": [
    "You realize you've been calling your boss by the wrong name for a year. What do you do?",
    "You're on a date and accidentally spill a drink all over them. How do you make it worse?",
    "You walk into the wrong bathroom. What's your exit strategy?",
    "You find a compromising photo of your friend on a public computer. What's the terrible thing to do?",
    "Your fly has been down all day during an important presentation. Someone finally tells you. Your response?"
  ],
  "Bad Advice": [
    "Your friend wants to quit their job to become a professional thumb wrestler. What terrible advice do you give?",
    "How do you 'subtly' tell someone they have bad breath?",
    "What's the worst way to ask for a raise?",
    "Your sibling is meeting their partner's parents for the first time. What's your worst tip?",
    "What's the most unhelpful advice for surviving a zombie apocalypse?"
  ],
  "Terrible Inventions": [
    "Invent a device that makes a common task 10x harder.",
    "What's a new social media app that everyone would hate?",
    "Describe a new food delivery service that is guaranteed to fail.",
    "What's a useless kitchen gadget that would sell surprisingly well?",
    "Design a piece of clothing that is both uncomfortable and unfashionable."
  ],
  "Horrible Dates": [
    "Describe the most cringeworthy thing to do on a first date.",
    "What's an instant deal-breaker when meeting someone new?",
    "How can you ensure there's no second date?",
    "What's the worst possible restaurant to take someone to?",
    "Your date reveals a truly bizarre hobby. How do you react terribly?"
  ],
  "Unfortunate Superpowers": [
    "If you could have any superpower, what's the most inconvenient one?",
    "You can talk to animals, but they all hate you. How does this play out?",
    "You can turn invisible, but only when no one is looking. What's the downside?",
    "You can fly, but only at a snail's pace. How is this terrible?",
    "You have super strength, but only in your pinky toes. What's the problem?"
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
