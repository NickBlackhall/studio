# Make It Terrible — Admin Content Lab Handoff

## Purpose
Build a protected writers' room inside the existing game. The tool generates potential response cards from one scenario at a time or from an imported scenario CSV, lets the admin curate them, and then inserts approved responses into the existing shared response deck.

The scenario is an **inspiration source**, not a permanent pairing. Approved responses belong to the shared `response_cards` deck and should be reusable with unrelated scenarios.

## Confirmed game content structure

### Scenario cards
A scenario establishes a desirable event, power, status, ordinary life event, curse, or absurd situation.

Examples:
- `You develop super strength overnight`
- `You wake up completely refreshed`
- `You become unable to use doors`

### Response cards
A response is a grammatical continuation that makes the scenario terrible.

Example:
- Scenario: `You gain the power of flight—`
- Response: `but you can only fly around your parents' bedroom while they have sex.`

Response cards frequently start with `but`, but the deck must not be restricted to one stem.

### Boondoggles
Boondoggles are surprise mini-games and remain a separate content system. They are the larger gameplay release valve when the normal scenario/response grammar feels repetitive.

## Confirmed scenario categories
- Life Things
- Super Powers
- Absurd & Surreal
- Pop Culture & Internet
- R-Rated

## Core writing algorithm

### Branch 1: desirable or positive scenario
Identify the exact reward, relief, fantasy, convenience, power, or status. Then attack that promise directly.

Strong directions:
- Preserve the benefit but make its use obscene, immoral, humiliating, or absurdly narrow.
- Reveal the humiliating reason the reward was earned.
- Add a terrible activation requirement.
- Make the benefit depend on someone else's suffering.
- Make the output technically available but functionally unreadable.
- Create whiplash between the reward and the awful life waiting afterward.

### Branch 2: scenario that is already bad
Do not treat a curse like a reward. Instead:
- escalate it;
- create a humiliating workaround;
- make the only exception worse than the curse;
- or reveal an audience that makes the situation unbearable.

Example:
- Scenario: `You become unable to use doors—`
- Better response: `unless someone carries you through like a bride.`

## Writing rules learned from calibration

1. **Attack the premise first.** Generic joke buckets produced visible patterns.
2. **Preserve and corrupt often beats simple destruction.** Keeping the reward makes the twist crueler.
3. **Imply a larger disaster.** `Your boss is asleep beside you` works because the missing story is worse than an explanation.
4. **Use vivid specificity.** Human teeth, a working human eye, a mother-bird feeding ritual, a mall Santa.
5. **Allow blunt idiot grenades.** Some cards should be stupid, crude, and immediate rather than elaborate.
6. **Use corrupted output.** CAPTCHAs, IKEA diagrams, redactions, Wingdings, whale song, broken auto-captions, or another newly invented obfuscation.
7. **Use arbitrary conditions carefully.** `Only during funerals` can work, but it became repetitive when used as a slot-filler.
8. **Use bare fragments.** `to prison inmates`, `at a drag brunch`, or `only on AOL` can be stronger than a complete sentence.
9. **Create aftermath whiplash.** The reward happens, then the person returns to a grotesque job or personal reality.
10. **Infantilize competent adults.** Embarrassing nicknames, lap-sitting instructions, mother-bird feeding, burping, or sponge baths.
11. **Keep output portable.** The source scenario should inspire a card, not imprison it.
12. **Do not force variety by filling categories.** Generate broadly, then keep the strongest genuinely different ideas.
13. **Character count matters.** Sweet spot: 15–80 characters. Hard ceiling: 105.
14. **Read-aloud speed matters.** The joke should land immediately.
15. **The human admin is the comedy judge.** Model scores are aids, not authority.

## Grammatical structures
Use a mix, with no more than two candidates in one batch sharing the same opening structure.

- `but you can only...`
- `but every time you...`
- `but it only works...`
- `and it also...`
- `and now...`
- `only during...`
- `only to...`
- `if you also...`
- `to activate it...`
- `at...`
- `under a name...`
- `followed by...`
- short bare fragments

## Favored joke mechanisms
- Premise corruption
- Reward misuse
- Humiliating reason for success
- Awful activation ritual
- Situational permission
- Someone else's misery as fuel
- Corrupted or obfuscated output
- Aftermath whiplash
- Adult infantilization
- Grotesque service condition
- Bizarre audience, location, or destination
- Implied unseen disaster
- Incongruous unrelated consequence
- Cheap crude punchline used sparingly

## Cooldowns and repetition controls

Temporarily suppress or limit:
- courts, subpoenas, evidence, police reports;
- HR and performance reviews;
- taxes, IRS, subscriptions, and overdraft fees without an actual joke;
- parents, spouse-recognition, and exes as default shortcuts;
- tattoos and browser history;
- funerals as a generic timing condition;
- masturbation, erections, and bowel movements repeated in the same batch;
- named celebrities and topical politicians unless topicality is deliberate;
- random cruelty to children or animals without a premise-linked comedic turn;
- the same sentence stem more than twice in one batch.

Cooldowns are not permanent bans. They exist because repetition makes the generator's scaffolding visible.

## Candidate quality checks

A candidate should be evaluated for:
- **Immediate clarity** — understood on first read.
- **Premise attack** — targets the source scenario rather than adding random trouble.
- **Specific image** — creates something concrete in the player's head.
- **Terribleness** — meaningfully ruins or escalates the scenario.
- **Portability** — works with at least two unrelated scenarios.
- **Freshness** — does not repeat recent motifs or stems.
- **Length** — 105 characters or fewer.

## Portability test
Display each candidate with three unrelated random scenarios. This is a writing aid, not a strict pass/fail gate. Some low-portability cards may still be worth keeping when exceptionally funny.

## Workflow

1. Admin signs in through Supabase Auth.
2. Admin selects an existing scenario, pastes one, or imports a CSV.
3. The server builds a prompt using:
   - the canonical rules;
   - approved calibration examples;
   - recent approved and rejected candidates;
   - active cooldowns;
   - the source scenario and category.
4. The model returns structured candidates.
5. Server applies character-count and duplicate checks.
6. Moderation metadata is stored for review.
7. Admin keeps, edits, rejects, or requests more like one candidate.
8. Admin may test portability against unrelated scenarios.
9. Approved candidates enter the review queue.
10. Admin either exports a CSV or publishes directly.
11. Direct publish inserts into `response_cards` with `is_active = false`.
12. Activation remains a separate deliberate action.

## Data facts from supplied exports
- `scenarios`: 587 rows.
- `response_cards`: 100 existing rows.
- Calibration: 109 approved response candidates and 7 review-only examples.
- Exact existing response-card columns:
  - `created_at`
  - `text`
  - `is_active`
  - `id`
  - `author_player_id`
  - `author_name`
- Exact scenario columns:
  - `created_at`
  - `text`
  - `category`
  - `id`

## Security model
- Regular game players do not need Supabase Auth.
- The admin uses a separate Supabase Auth account.
- An `admin_users` table identifies authorized user UUIDs.
- Protected pages verify a real Supabase session and call `is_admin()`.
- API routes repeat the authorization check; UI hiding is not security.
- A server-only service-role client performs database writes after authorization.
- New admin tables use RLS.
- The service-role key and OpenAI key never enter browser code.

## AI provider
The proposed code uses OpenAI's Responses API with Structured Outputs and a Zod schema. The model name is an environment variable so it can be changed without a code edit.

[Unverified] Model behavior is expected to improve with the approved/rejected reference set, but no prompt can guarantee consistent humor or prevent recurring patterns. Human selection remains required.

## Out of scope for the first release
- Fully autonomous publishing.
- Model fine-tuning.
- Embedding infrastructure.
- Public community submission moderation.
- Automatic activation of generated cards.
- Rewriting the existing scenario deck.
- Generating Boondoggles in the same workflow.
- A fully separate R-rated prompt. Spicy calibration should be handled as a later dedicated pass.
