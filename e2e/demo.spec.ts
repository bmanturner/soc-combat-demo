import { expect, test, type Page } from '@playwright/test';

type Soc = {
  store: { getState: () => Record<string, unknown> & { battle: { active: { unitId: string } | null; outcome: string; units: { id: string; pos: { x: number; y: number } }[]; config: Record<string, unknown> } | null } };
  tileCenter?: (x: number, y: number) => { x: number; y: number };
};

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function clickTile(page: Page, x: number, y: number) {
  const canvas = page.locator('[data-testid=board] canvas');
  const box = (await canvas.boundingBox())!;
  const c = await page.evaluate(([tx, ty]) => (window as unknown as { __soc: Soc }).__soc.tileCenter!(tx!, ty!), [x, y]);
  await page.mouse.click(box.x + c.x, box.y + c.y);
}

async function startEncounter(page: Page, id: string, weapon = 'daggers', armor?: string) {
  await page.goto('/');
  await page.getByTestId(`enc-${id}`).click();
  await page.getByTestId(`weapon-${weapon}`).click();
  if (armor) await page.getByTestId(`armor-${armor}`).click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __soc: Soc }).__soc.tileCenter);
}

test('menu lists every encounter', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  for (const id of ['granary', 'rat_nest', 'wolves', 'bandits', 'cultists', 'valley_bandits', 'nephilim']) await expect(page.getByTestId(`enc-${id}`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('player can move by clicking the board, and the timeline previews the cost', async ({ page }) => {
  const errors = watchErrors(page);
  await startEncounter(page, 'nephilim', 'daggers', 'light');
  await expect(page.getByTestId('turn-box')).toContainText("Jubal's turn");
  // Hover a tile 4 up from Jubal (4,8) → (4,4): ghost text shows the projected next turn.
  const canvas = page.locator('[data-testid=board] canvas');
  const box = (await canvas.boundingBox())!;
  const c = await page.evaluate(() => (window as unknown as { __soc: Soc }).__soc.tileCenter!(4, 4));
  await page.mouse.move(box.x + c.x, box.y + c.y);
  await expect(page.getByTestId('ghost-text')).toContainText('next turn in 65');
  await clickTile(page, 4, 4);
  await expect(page.getByTestId('log')).toContainText('Jubal moves 4 tiles to (4,4) (40 AP)');
  const pos = await page.evaluate(() => (window as unknown as { __soc: Soc }).__soc.store.getState().battle!.units.find((u) => u.id === 'jubal')!.pos);
  expect(pos).toEqual({ x: 4, y: 4 });
  expect(errors).toEqual([]);
});

test('ending a turn hands control to the enemy AI and back', async ({ page }) => {
  const errors = watchErrors(page);
  await startEncounter(page, 'granary', 'polearm');
  // Waiting is 25 AP, so Jubal may get a few turns before the rats come up.
  for (let i = 0; i < 8; i++) {
    if ((await page.getByTestId('log').textContent())?.includes("Granary Rat's turn")) break;
    await expect(page.getByTestId('end-turn')).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('end-turn').click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByTestId('log')).toContainText("Granary Rat's turn", { timeout: 20_000 });
  await expect(page.getByTestId('turn-box')).toContainText("Jubal's turn", { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('the bot can play the granary to a result screen', async ({ page }) => {
  const errors = watchErrors(page);
  await startEncounter(page, 'granary', 'two_handed');
  await page.locator('select').first().selectOption('4');
  await page.getByTestId('bot-toggle').check();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('result')).toContainText(/Victory|Defeat/);
  expect(errors).toEqual([]);
});

test('settings travel in the share link', async ({ page }) => {
  const errors = watchErrors(page);
  await startEncounter(page, 'wolves', 'shield', 'heavy');
  await page.getByTestId('open-settings').click();
  const row = page.getByTestId('setting-diagonalMovement');
  await row.locator('input[type=checkbox]').check();
  await page.getByTestId('apply-settings').click();
  await expect(page).toHaveURL(/c=/);
  const url = page.url();
  // A fresh visit with that link restores encounter, loadout and the changed rule.
  const fresh = await page.context().newPage();
  await fresh.goto(url);
  await expect(fresh.getByTestId('setup')).toBeVisible();
  await expect(fresh.getByTestId('weapon-shield')).toContainText('✓');
  await expect(fresh.getByTestId('armor-heavy')).toContainText('✓');
  await fresh.getByTestId('start').click();
  const diag = await fresh.evaluate(() => (window as unknown as { __soc: Soc }).__soc.store.getState().battle!.config.diagonalMovement);
  expect(diag).toBe(true);
  expect(errors).toEqual([]);
});
