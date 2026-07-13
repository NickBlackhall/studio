# Host Powers & Reset — Specification

Written 2026-07-13 from Nick's answers. This exists because reset was never
specified, and that is why it kept breaking: every session guessed at it
differently. **If you change reset, change this document first.**

Nick's words: *"the host controls the room. they can kick a player if they need,
they can end the game if they need to and that should reset players back to the
lobby or the player ready screen. i also had a big 'master' reset button that is
hidden by a PIN in case we needed to reset the whole game (all rooms) for testing
purposes."*

---

## Who is the host

The host is **the person who created the room**, permanently, for the life of the
room (`games.created_by_player_id`). It is not "whoever readied up first". Joining
order does not matter.

If the host leaves, the room ends (see *Host leaves*).

---

## The four distinct actions

These were historically jammed into one "reset" button, which is the root of the
confusion. They are four different things.

### 1. Host: End Game

**Who:** host only.
**Means:** "stop this game, but we're still here and might play again."

- Game returns to the **lobby / ready screen**.
- **Players stay in the room.** They are *not* removed and *not* sent to the main menu.
- Scores reset to 0. Everyone is marked not-ready.
- Round state is cleared: hands, responses, winners, scenario, judge, round number.
- The **room survives** and keeps its code. The **host stays host**.

> This is the big behavioural change. The old reset *deleted every player row*,
> which is why everyone got ejected to the main menu. That is not what End Game
> should do.

### 2. Player: Leave Game

**Who:** anyone, including the host (but see *Host leaves*).
**Means:** "I'm out, carry on without me."

- Only that player is removed. Everyone else keeps playing.
- If the leaver was the judge, the judge is reassigned.
- If this drops the room below the minimum to play, the game falls back to the lobby.
- If they were the **last** player, the room is **deleted** (see *Abandoned rooms*).

### 3. Host: Kick Player

**Who:** host only. Same effect as *Leave Game*, applied to someone else.
The kicked player is told they were removed by the host, and lands on the main menu.

### 4. Master Reset (PIN)

**Who:** developer, via the PIN-gated dev console.
**Means:** "wipe everything, we're testing."

- Deletes **every room in the database**, including other people's games.
- Exists only for testing. It is deliberately loud and deliberately hard to reach.

---

## Host leaves

The room ends for everyone. All players are returned to the main menu and the room
is deleted. (There is no host transfer today — a possible future feature.)

## Abandoned rooms

A room is **deleted immediately** when its last player leaves. Rooms should not
linger waiting for a sweep — that is why they piled up in the browser.

The idle sweep stays as a **backstop only**, for players who vanish without
leaving cleanly (closed tab, dead battery, lost signal). It is not the primary
mechanism.

---

## Invariants (things that must never happen again)

1. **A reset must always name the game it is resetting.** The old code, when given
   no target, reset *the oldest game in the database* — so an in-game reset button
   destroyed a stranger's room and left the presser's own game running. No reset
   may ever guess at its target. `resetGameForTesting` now throws without a `gameId`.

2. **Nothing may fail silently.** A stuck `gameResetFlag` used to make "Join Room" a
   dead button: it returned early with no toast, no error, no navigation. If an
   action is refused, the player is told why.

3. **A reset flag must always get cleared.** It is set on reset and cleared on
   arriving at the menu. It must not depend on a component remounting, because a
   soft navigation does not remount the root layout.

---

## Status

- [x] Reset must name its target (`resetGameForTesting` throws without `gameId`)
- [x] Master reset wipes all rooms (`masterResetAllGames`, PIN-gated dev console)
- [x] Reset flag can no longer get permanently stuck
- [x] End Game keeps players and returns them to the lobby (`returning_to_lobby`)
- [x] Room deleted immediately when the last player leaves, and when the host leaves
- [ ] Host powers surfaced in the UI (explicit "End Game" button, host badge)
- [ ] **Not yet verified end-to-end** — see below

## Verification gap (read this)

The changes above typecheck, build, and pass the 80 unit tests, but they have
**not been driven end-to-end**, because there is no test database: `.env.test`
points at a Supabase project that is paused and unreachable, and the free plan is
capped at 2 active projects. Running the e2e suite against `.env.local` would
create and destroy rooms in the **live** database.

Before trusting any of this, it needs a real two-browser run:
host ends a game -> both players land in the lobby, still seated, scores zeroed.

