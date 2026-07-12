import { multiPlayerTest as test, createGameWithPlayers, startGame } from '../helpers/multi-player';

test('probe round 2 category error', async ({ multiPlayer }) => {
  const { pages } = multiPlayer;
  for (const [i, p] of pages.entries()) p.on('console', m => {
    const t = m.text();
    if (/error|Error|failed|CATEGORY|HEARTBEAT|RECEIVED UPDATE|RECAP/i.test(t)) console.log(`BROWSER[p${i}]:`, t.slice(0, 200));
  });

  await createGameWithPlayers(multiPlayer, 2);
  await startGame(multiPlayer, 2);
  console.log('=== game started, judge is p0 ===');

  // Judge (p0) unleashes the default category
  const judge = pages[0];
  await judge.waitForSelector('img[alt="Unleash Scenario"]', { timeout: 30_000 });
  await judge.waitForTimeout(1000);
  await judge.click('img[alt="Unleash Scenario"]', { force: true });
  console.log('=== category unleashed ===');

  // Player (p1) submits top card: click to select, then click Submit button
  const player = pages[1];
  await player.waitForTimeout(4000);
  await player.keyboard.press('Escape'); // close any stray modal
  await player.waitForTimeout(500);
  const topCard = player.locator('[style*="touch-action: none"]').first();
  await topCard.click({ force: true });
  await player.waitForTimeout(1500);
  await player.click('img[alt="Submit Card"]', { force: true });
  console.log('=== player card submitted ===');
  await player.waitForTimeout(4000);

  // Judge picks the winner: select top submission card, then Crown Winner
  await judge.waitForTimeout(4000);
  const topSubmission = judge.locator('[style*="touch-action: none"]').first();
  for (let a = 0; a < 4; a++) {
    if (await judge.locator('img[alt="Crown Winner"]').first().isVisible().catch(() => false)) break;
    await topSubmission.click({ force: true }).catch(() => {});
    await judge.waitForTimeout(2000);
  }
  await judge.click('img[alt="Crown Winner"]', { force: true });
  console.log('=== winner crowned ===');

  // Recap auto-advances to round 2 from the judge client. Observe BOTH
  // screens for 30s: old judge (p0) should LOSE the judge view; new judge
  // (p1) should GAIN the category selector.
  for (let t = 0; t < 6; t++) {
    await judge.waitForTimeout(5000);
    const p0HasSelector = await pages[0].locator('img[alt="Unleash Scenario"]').isVisible().catch(() => false);
    const p1HasSelector = await pages[1].locator('img[alt="Unleash Scenario"]').isVisible().catch(() => false);
    console.log(`t+${(t + 1) * 5}s: p0(old judge) selector=${p0HasSelector} | p1(new judge) selector=${p1HasSelector}`);
    if (p1HasSelector) { console.log('!!! PASS: new judge sees category selector'); break; }
  }
});
