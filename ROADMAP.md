# Make It Terrible — Roadmap

Living wishlist, written 2026-07-13. Ordered roughly by Nick's interest, not
effort. (The older AUDIT_ROADMAP.md / TESTING_ROADMAP.md are point-in-time
audit docs; this is the product roadmap.)

## Player-card recognition & stats

- [x] **Byline on player-submitted cards** — "— submitted by NAME" in small type
  on the card face, in hands and on the judge's screen. (Shipped 2026-07-13.)
- [ ] **Card stats: dealt / played / won counts.** "Jake's card has won 4 times."
  Needs small DB additions (counters on `response_cards`, or an events table),
  incremented in deal/submit/selectWinner. Surfacing: a "Hall of Terrible Fame"
  screen, or a stat line under the byline.
- [ ] **Winner callout** — when a round is won with a player-authored card,
  announce it: "Round won with Jake's card!" The best social payoff moment.
- [ ] **Import the Google Form submissions.** The "Submit Cards" form feeds a
  Google Sheet that never reaches the database — any cards submitted there are
  stranded. Export the sheet as CSV → import with author credit.

## Player accounts (deliberately later)

Not yet worth the friction: the join-in-seconds anonymous model is right for a
party game. Accounts earn their keep when we want cross-night stats, saved
custom decks, or friend lists — and card stats (above) can be built WITHOUT
accounts by keying on author name. When the time comes, Supabase Auth layers
onto the existing session system without a rebuild. (The Settings menu already
promises "Player Accounts — Coming soon!" — players are half-expecting this.)

## Solo / new-player experience (Nick, 2026-07-14)

- [ ] **Bot players.** Two tiers, worth building separately:
  - *Simple bots* — a bot is just a player row with nobody behind it. Each round
    it plays a random card from its dealt hand; when it's judge, it picks a
    random winner. This automates actions the game already has — no AI, no new
    infrastructure. Solves solo play and "one friend short of the minimum."
  - *Smart bots* (stretch) — bots write original responses via an LLM call
    instead of drawing from the deck. Real feature: API cost, latency, needs
    light output moderation. Build after simple bots prove out the plumbing.
- [ ] **Tutorial mode.** Pairs naturally with simple bots: a scripted mini-round
  against bots, with guided callouts ("this is your hand," "drag up to
  submit," "you're the judge this round"). Design these two together rather
  than separately — the tutorial IS a bot-populated game with a narrator layer.

## Camera / video avatars (Nick, 2026-07-14) — needs a real decision, not just code

Two very different asks hiding under one idea:
- **(a) Local camera as your own avatar tile** — a simple `getUserMedia` call,
  self-contained, no new infrastructure. Cheap flourish if wanted.
- **(b) Other players seeing your camera (actual video chat)** — a different
  technical world: WebRTC, signaling servers, TURN/STUN, ongoing hosting cost,
  and for a party game, real consent/safety considerations (this could easily
  be played with kids or off a public room listing).
- **Honest recommendation:** skip (b) unless this becomes a product serious
  enough to own video infrastructure. Anyone playing remotely today already has
  FaceTime/Zoom open — the engineering cost buys little over that. (a) is fine
  to build any time as pure polish.

## Bar / venue mode — long-term pivot (Nick, 2026-07-14)

Not a feature — closer to **a second product built on the same game engine**.
Needs its own design pass, not a bullet in the feature list:
- A permanent **venue host** role (the bar employee), likely long-lived rooms
  tied to a scheduled night rather than the current ephemeral room model.
- **Teams, not individuals** — a join flow where a table shares one hand/screen
  per team rather than one per person.
- A **big-screen leaderboard view** meant for a TV/projector — this is the
  existing "spectator mode" idea (see Rooms & hosting) wearing a venue hat.
- Likely a different **business relationship**: selling to venues (B2B) rather
  than to friend groups (B2C) — different onboarding, support, and pricing.
- Possibly a content-tone toggle: still edgy, but venue-appropriate with staff
  present.
- **Revisit this as its own planning doc when it's actually time to build it** —
  don't let it creep into the consumer app's roadmap piecemeal.

## Visual cohesion pass (Nick, 2026-07-14: "a lot of it looks a little amateur")

Checked 2026-07-14: the font side is already disciplined — only two typefaces
in use (IM Fell English SC for display, Corben as accent), no font sprawl. The
"doesn't quite meld" feeling is almost certainly the **art**, not typography:
pieces were very likely generated across different sessions/tools/models over
the life of the project, so even where the style (woodcut/vintage-poster)
matches, the color grade, line weight, and grain level don't.

The fix is a **cohesion pass**, not a redo:
- [ ] Pick 2–3 pieces as the canon reference look (palette, line weight, grain).
- [ ] Apply one consistent color-grade / duotone treatment across all art —
  this alone can visually unify mismatched sources without touching content.
- [ ] Standardize the card-frame/border chrome so every card type shares one
  treatment regardless of its source art.
- Do this alongside the **Art refit pass** below — same root cause, same pass.

## Art & layout

- [ ] **Art refit pass.** Some art no longer quite fits its frame/context after
  the phone-proportion lock (Nick, 2026-07-13: "some of the art doesn't quite
  fit anymore, but I'll deal with that later"). Inventory which screens, then
  re-crop or re-generate. Originals live in `art-originals/` at full resolution.
  Bundle with the visual cohesion pass above.
- [ ] **Motion polish pass** (Motion/framer-motion already installed; no new
  engine needed for most of this):
  - Press-feedback on every image button (compress + deepen shadow under the
    finger) — the single biggest "real app, not a prototype" signal.
  - "YOU are the Judge" stinger — a stamp-down card when the role rotates.
    Turns the game's most confusing moment into its most theatrical.
  - Staged judge reveal — submissions flip one at a time with a beat between,
    instead of all at once. Builds table anticipation; probably the highest
    fun-per-effort item on this whole list.
  - Score tick-up (numbers roll instead of snapping), idle card float in hand,
    spring-into-slot on submit instead of teleporting.
  - Toasts restyled to match the parchment/woodcut theme — currently the one
    UI element that ignores the game's art direction entirely.
  - Ambient poster drift (subtle Ken Burns on background art) — pure CSS.
- [ ] **View Transitions between screens** (lobby → game → winner reveal
  morphing instead of hard-cutting). Native browser API, React/Next support is
  recent — verify current support before committing to this one.
- [ ] Winner celebration juice: confetti on round/game winner, haptics on
  Android (iOS doesn't allow web vibration).
- [ ] **Shareable winner card** (stretch): generate an image — "BECKY WON — with
  Jake's card" — pushed to the phone's share sheet after a game. Cheap version
  of a bigger idea (a full Remotion-rendered game-night recap video is possible
  later, but Remotion is a video renderer, not a UI engine — don't reach for it
  for in-game motion).
- [ ] **Rive mascots** (biggest swing, biggest payoff): the devil/angel art
  reacting live — smirking during judging, cheering the winner. This is an art
  project as much as a code project (authored in Rive's editor with a state
  machine), not just an engineering task.

## Rooms & hosting

- [ ] Host transfer (host hands the crown to another player before leaving).
- [ ] Room privacy defaults: rooms are public-by-default, so home games appear
  in everyone's browser. Consider private-by-default + explicit "list publicly".
- [ ] Spectator mode (watch without a hand).

## Content rating: host controls the spice (Nick, 2026-07-14 — planned, not built)

**Decision made: adult content defaults OFF.** R-Rated is opt-in; the host owns
the dial. Full design, ready to implement:

- **`games.allow_adult_content boolean not null default false`.** Set via a
  toggle in Create Room; changeable by the host only, and only while
  `game_phase = 'lobby'` (never mid-round). End Game returns everyone to the
  lobby, so "kids went to bed → end game → flip toggle → play again" works in
  the same room.
- **Server-enforced, not UI-hidden.** Hide the R-Rated panel in the judge's
  category picker in clean rooms AND make `selectCategory` refuse R-Rated for
  them — today the server accepts any category string a client sends, so a
  UI-only toggle would be decorative.
- **⚠️ Implementation landmine:** the scenarios table stores the category as
  `" R-Rated"` — leading space — while `src/lib/data.ts` has `"R-Rated"`
  without it. All category comparisons for this feature MUST normalize
  (trim + case) or the filter will silently not filter.
- **Visible to players:** an "18+" badge in the lobby and on the room browser
  when enabled. People should know what room they're joining; the clean
  default should be visible too.
- **Answer deck:** `response_cards.is_adult boolean not null default false`;
  `dealCardsFromSupabase` excludes flagged cards in clean rooms. A regex scan
  found ~7/1024 explicit cards — generate the candidate list for Nick to
  hand-review before backfilling flags (regex is a crude judge).
- **Write-ins inherit the room's rating:** a judge-approved write-in from an
  18+ room enters the permanent deck flagged `is_adult`, so it can never leak
  into a family game. Approved in a clean room → unflagged. No extra UI.
- **Honest limitation (say it in the UI docs, don't pretend otherwise):** the
  write-in card is freeform — a player in a clean room can still type
  anything. The judge reading submissions is the moderator, as in any party
  game.
- **Optional follow-up:** one-time content audit of the Boondoggles category
  (mostly tame — famous duos, party challenges — but at least one sampled
  prompt was borderline).
- Estimated cost: one migration (two columns), Create Room toggle, lobby/browser
  badge, category-picker filter, two server checks, one dealer filter. ~Half a
  day, mostly testing.

## Gameplay

- [ ] **Boondoggle visibility.** Boondoggles need 3+ players (40% roll per
  category pick, never back-to-back) — fine, but 2-player playtests never see
  them, and nothing explains their absence. Maybe surface a hint, or allow a
  2-player variant.
- [ ] Deck controls per room: hand size, points to win, categories on/off,
  player-cards-only nights. (The content-rating toggle above is the first and
  most important of these — build it first and the rest follow its pattern.)

## Infrastructure

- [ ] **Verify the update banner in the wild.** Shipped but unconfirmed — Nick
  didn't see it on the first deploy it should have caught (may simply have
  missed the window; the Settings build tag is the check).
- [ ] Test database. CI already runs against its own throwaway Supabase; local
  e2e still points at production. Revive the old paused project as a sandbox
  when a free-plan slot opens, then unskip the reset-flow e2e specs.
- [ ] Set `MASTER_RESET_PIN` in Netlify (until then, master reset is disabled
  on the live site).
- [ ] Card-count invariant test: after any submit/deal cycle, every player has
  exactly CARDS_PER_HAND cards (would have caught the write-in hand-growth bug).
- [ ] Revoke the old Netlify CLI token (app.netlify.com/user/applications).
