# Playtest checklist — 2026-07-13 deploy

What shipped since your last playtest: WebP art + the 208 MB first-visit fix,
phone-frame layout, the Join Room fix, and the full reset redesign
(HOST_AND_RESET_SPEC.md). Items marked ★ are the ones that verify brand-new,
never-run-in-production behavior — do those even if you skip the rest.

**Before you start (do not skip):** fully close the game on BOTH phones
(swipe it away, not just background it) and reopen. Open tabs run the old
cached bundle and you'd be testing code from last week.

Use two phones (A = you/host, B = Becky). Laptop optional for #2.

---

1. **First load & art.** Game loads noticeably faster on first install/refresh.
   Posters, avatars, cards, buttons all look right — no blurry or missing images.

2. **Laptop shape (optional).** On the laptop, the game is a phone-shaped column
   in the middle with the parchment texture either side — not stretched.

3. ★ **Join by code.** A creates a room. B taps Join by Code, enters the code.
   *Expect:* B lands in the lobby with A. If anything blocks the join, B sees a
   message saying why — the button must never just do nothing.

4. **Room browser.** B leaves (or use a 3rd device/tab), opens Browse Public
   Rooms, sees A's room, taps Join Room. *Expect:* lands in A's lobby.

5. **Play 2–3 rounds.** Cards deal, submissions work, judge rotates between
   rounds, winner screens show. (This is regression cover — it worked before.)

6. ★ **Host ends the game mid-round.** A opens the game menu → PIN reset (6425).
   *Expect:* BOTH phones show "The host ended the game. Back to the lobby..."
   and land in the SAME room's lobby — still seated, scores at 0, nobody
   kicked to the main menu. **This is the headline change.**

7. ★ **Play again from that lobby.** Both ready up and start a new game from the
   same room. *Expect:* starts cleanly — proves the room survives an End Game.

8. **Play to a winner → Play Again.** Finish a game, A (host) taps Play Again.
   *Expect:* both phones back in the room's lobby, seated, scores 0.

9. ★ **Host leaves.** Mid-game, A exits to the main menu (leave game).
   *Expect:* within ~10 seconds B is told the game ended and lands on the main
   menu — not frozen on a dead game screen. The room is gone from Browse.

10. ★ **Empty room cleanup.** Create a room solo, then leave it. Open Browse
    Public Rooms. *Expect:* that room is NOT in the list.

11. **Kick.** In a game, A opens dev console (PIN 6425) and kicks B.
    *Expect:* B gets a "removed by host" message and lands on the main menu;
    A keeps playing (or drops to lobby if under 3 players — that's correct).

12. ★ **The old dead-button probe.** After #9 or #11, B immediately tries to
    join a new room. *Expect:* it just works. (This was the silent dead Join
    button.)

---

**If something fails:** don't debug — note the item number and what EACH phone
showed, and tell Claude. Diagnostics stream to the client_logs table
automatically, so the room code + rough time is enough to reconstruct it.

**Known gaps (not bugs):** master reset ("Wipe ALL Rooms" in dev console) is
disabled on the live site until MASTER_RESET_PIN is set in Netlify env vars.
Non-hosts pressing Play Again get an error message — hiding that button from
them is queued work.
