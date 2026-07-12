import { test, expect, Page } from '@playwright/test';

/**
 * Coverage for the real join flow. The pre-existing join tests in basic-flow.spec.ts
 * target a UI that does not exist (a /lobby/:code route, a name+code form on the
 * homepage), so they have never passed and never guarded this path.
 */

async function openMainMenu(page: Page) {
  await page.goto('/');
  await page.click('[data-testid="enter-chaos-button"]', { force: true });
  await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
}

async function createRoom(page: Page): Promise<string> {
  await openMainMenu(page);
  await page.click('[data-testid="join-create-card"]', { force: true });
  await page.click('[data-testid="menu-create-new-room"]');
  await page.click('[data-testid="create-game-button"]');
  await page.waitForURL(/[?&]room=\w+/, { timeout: 20000 });
  const code = new URL(page.url()).searchParams.get('room');
  expect(code).toBeTruthy();
  return code!;
}

test('a host can create a room and land in it', async ({ page }) => {
  const code = await createRoom(page);
  expect(code).toMatch(/^\w{6}$/);
});

test('a second player can join that room by code', async ({ page, browser }) => {
  const hostCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const code = await createRoom(hostPage);

  await openMainMenu(page);
  await page.click('[data-testid="join-create-card"]', { force: true });
  await page.click('[data-testid="menu-join-by-code"]');
  await page.fill('[data-testid="game-code-input"]', code);
  await page.click('[data-testid="join-room-button"]');

  await expect(page).toHaveURL(new RegExp(`[?&]room=${code}`), { timeout: 20000 });

  await hostCtx.close();
});

/**
 * Regression: a stale `gameResetFlag` in localStorage used to make Join Room a
 * silent dead button — handleJoinRoom returned early with no toast, no error and
 * no navigation, so the click simply did nothing. The flag got stuck because the
 * game page set it and then soft-navigated (router.push), which does not remount
 * SharedGameProvider, and the only code clearing the flag was a mount-only effect.
 *
 * Whatever else changes, clicking Join must never be silent: it either joins, or
 * it tells the player why it didn't.
 */
test('a stale reset flag never leaves Join Room silently dead', async ({ page, browser }) => {
  const hostCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const code = await createRoom(hostPage);

  await openMainMenu(page);
  await page.evaluate(() => localStorage.setItem('gameResetFlag', 'true'));

  await page.click('[data-testid="join-create-card"]', { force: true });
  await page.click('[data-testid="menu-join-by-code"]');
  await page.fill('[data-testid="game-code-input"]', code);
  await page.click('[data-testid="join-room-button"]');

  const joined = page.waitForURL(new RegExp(`[?&]room=${code}`), { timeout: 12000 })
    .then(() => 'joined' as const)
    .catch(() => null);
  const explained = page.locator('[role="status"], [data-testid="error-message"]')
    .filter({ hasText: /./ }).first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => 'explained' as const)
    .catch(() => null);

  const outcome = await Promise.race([joined, explained]);
  expect(outcome, 'clicking Join did nothing at all — no navigation and no message').toBeTruthy();

  await hostCtx.close();
});
