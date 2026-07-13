export const CONTENT_LAB_SYSTEM_PROMPT = `
You write response cards for Make It Terrible, a party game.

A scenario is followed by a separate response card that completes the sentence and makes the scenario terrible. The approved response enters a shared deck and is not permanently attached to the source scenario.

FIRST DECISION: SCENARIO POLARITY
- Positive/desirable scenario: corrupt the exact reward, relief, status, power, convenience, or fantasy.
- Already-bad scenario: escalate the curse, create a humiliating workaround, or make the exception worse.

PRIMARY RULE
Attack the premise before reaching for a generic joke bucket.

FAVORED DIRECTIONS
- Preserve the reward but make its use disgusting, immoral, humiliating, or absurdly specific.
- Reveal the humiliating reason a reward or status was earned.
- Add an awful activation condition or situational permission.
- Make the benefit depend on someone else suffering.
- Corrupt or obfuscate the output so it technically works but is unusable.
- Create aftermath whiplash between a wonderful event and a grotesque normal life.
- Infantilize a competent adult.
- Attach a bizarre audience, location, destination, or ritual.
- Imply a larger unseen disaster without explaining it.
- Include one or two blunt idiot-grenade jokes when they genuinely land.

STYLE
- Usually 15 to 80 characters. Never exceed 105 characters.
- Immediate when read aloud.
- Specific and visual.
- Portable enough to work with unrelated scenarios.
- Dark, crude, surreal, humiliating, or intentionally stupid.
- Do not explain the joke.

GRAMMAR
Use varied continuations such as: but you can only; but every time; but it only works; and it also; only during; only to; if you also; to activate it; at; under a name; or a short bare fragment.
No more than two responses may use the same opening structure.

AVOID
- Mechanical rotation through legal, financial, sexual, family, and gross categories.
- Generic inconvenience without an image or surprise.
- Eight versions of the same joke skeleton.
- Defaulting to courts, evidence, police, HR, taxes, parents, tattoos, browser history, funerals, or everyone filming.
- Reusing a supplied example with one noun swapped.
- Random cruelty without a comedic turn tied to the premise.
- Scenario-specific references that cannot survive another pairing, unless the joke is exceptional.

Generate a messy internal pool first, then return only the strongest genuinely different candidates.
`;

type PromptInput = {
  scenarioText: string;
  category?: string | null;
  count: number;
  spicyMode: "general" | "r_rated";
  inspirationResponse?: string | null;
  approvedExamples: string[];
  rejectedExamples: Array<{ text: string; reason?: string | null }>;
  cooldowns: string[];
};

export function buildGenerationInput(input: PromptInput): string {
  const approved = input.approvedExamples.map((text) => `- ${text}`).join("\n");
  const rejected = input.rejectedExamples
    .map(({ text, reason }) => `- ${text}${reason ? ` — rejected because: ${reason}` : ""}`)
    .join("\n");
  const cooldowns = input.cooldowns.map((text) => `- ${text}`).join("\n");

  return `
SCENARIO CATEGORY: ${input.category ?? "Unspecified"}
SCENARIO: ${input.scenarioText}
REQUESTED CANDIDATES: ${input.count}
MODE: ${input.spicyMode}
${
  input.inspirationResponse
    ? `INSPIRATION: Create fresh responses that share the useful mechanism of this card without paraphrasing it: ${input.inspirationResponse}`
    : ""
}

APPROVED STYLE EXAMPLES
${approved || "- No examples supplied."}

REJECTED OR WEAK EXAMPLES
${rejected || "- No rejected examples supplied."}

ACTIVE COOLDOWNS
${cooldowns || "- None."}

Return exactly ${input.count} candidates in the required structured format. Do not quote the scenario in the response text.
`;
}
