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
onto the existing session system without a rebuild.

## Art & layout

- [ ] **Art refit pass.** Some art no longer quite fits its frame/context after
  the phone-proportion lock (Nick, 2026-07-13: "some of the art doesn't quite
  fit anymore, but I'll deal with that later"). Inventory which screens, then
  re-crop or re-generate. Originals live in `art-originals/` at full resolution.
- [ ] **Motion polish pass** (framer-motion already installed; no new engine):
  press-feedback on all image buttons; lobby player list entrance/ready
  animations; toasts restyled to match the parchment/woodcut theme; card lift +
  spring-into-slot on drag; "YOU are the Judge" stinger on rotation.
- [ ] Winner celebration juice: confetti on round/game winner, haptics on
  Android (iOS doesn't allow web vibration).

## Rooms & hosting

- [ ] Host transfer (host hands the crown to another player before leaving).
- [ ] Room privacy defaults: rooms are public-by-default, so home games appear
  in everyone's browser. Consider private-by-default + explicit "list publicly".
- [ ] Spectator mode (watch without a hand).

## Gameplay

- [ ] **Boondoggle visibility.** Boondoggles need 3+ players (40% roll per
  category pick, never back-to-back) — fine, but 2-player playtests never see
  them, and nothing explains their absence. Maybe surface a hint, or allow a
  2-player variant.
- [ ] Deck controls per room: hand size, points to win, categories on/off,
  player-cards-only nights.

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
