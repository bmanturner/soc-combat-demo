import { expect, test, type Page } from '@playwright/test';
import type { controller } from '../src/game/controller';
import type { store } from '../src/game/store';

declare global { interface Window { __soc: { store: typeof store; controller: typeof controller; tileCenter?: (x: number, y: number) => { x: number; y: number } }; } }

async function start(page: Page) {
  await page.goto('/#e=granary');
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__soc.tileCenter);
}

test('U-07 Help and Settings capture combat keys and modal focus', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: '?', exact: true }).click();
  await page.keyboard.press('a');
  await page.keyboard.press('1');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => ({ actions: window.__soc.store.getState().actions.length, mode: window.__soc.store.getState().mode }))).toEqual({ actions: 0, mode: { kind: 'move' } });
  await expect(page.getByTestId('help')).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid=help]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('help')).toBeHidden();
  await page.keyboard.press('a');
  expect(await page.evaluate(() => window.__soc.store.getState().mode.kind)).toBe('attack');
  await page.keyboard.press('m');
  await page.getByTestId('open-settings').click();
  await page.keyboard.press('a');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__soc.store.getState().actions.length)).toBe(0);
});

test('U-12 all drawer close paths discard drafts, including focused Escape', async ({ page }) => {
  await start(page);
  for (const close of ['escape', 'button', 'backdrop']) {
    await page.getByTestId('open-settings').click();
    const slider = page.getByTestId('setting-movementBudget').locator('input');
    await slider.fill('85');
    await slider.focus();
    if (close === 'escape') await page.keyboard.press('Escape');
    else if (close === 'button') await page.getByRole('button', { name: 'Close rules', exact: true }).click();
    else await page.locator('.drawer-wrap').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('settings')).toBeHidden();
    await page.getByTestId('open-settings').click();
    await expect(slider).toHaveValue('50');
    await page.getByRole('button', { name: 'Close rules', exact: true }).click();
  }
});

test('U-09 copying draft changes neither fight, settings nor URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page);
  const url = page.url();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('setting-movementBudget').locator('input').fill('80');
  await page.getByRole('button', { name: 'Copy share link', exact: true }).click();
  await expect(page.getByTestId('toast')).toContainText('Share link copied');
  expect(await page.evaluate(() => [window.__soc.store.getState().config.movementBudget, window.__soc.store.getState().battle!.config.movementBudget])).toEqual([50, 50]);
  expect(page.url()).toBe(url);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await context.newPage();
  await fresh.goto(link);
  expect(await fresh.evaluate(() => window.__soc.store.getState().config.movementBudget)).toBe(80);
});

test('U-13 Help uses active rules and setup movement uses floor', async ({ page }) => {
  await page.goto('/#e=wolves');
  await page.evaluate(() => window.__soc.controller.applyConfig({ ...window.__soc.store.getState().config, movementBudget: 80, noActionTurnAp: 40, flankDamageTaken: 0.4, flankReactionMult: 0.7 }, false));
  await expect(page.getByTestId('armor-heavy')).toContainText('5 tiles');
  await page.getByTestId('start').click();
  await page.getByRole('button', { name: '?', exact: true }).click();
  await expect(page.getByTestId('help')).toContainText('80 AP of movement');
  await expect(page.getByTestId('help')).toContainText('40 AP');
  await expect(page.getByTestId('help')).toContainText('+40%');
  await expect(page.getByTestId('help')).toContainText('70%');
});

test('U-01 leaving and restarting during animation does not strand AI', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await page.locator('.topbar select').selectOption('0.5');
  await page.getByTestId('bot-toggle').check();
  await page.waitForFunction(() => window.__soc.store.getState().busy);
  await page.getByRole('button', { name: '☰', exact: true }).click();
  await page.getByTestId('enc-wolves').click();
  await page.getByTestId('start').click();
  await page.waitForFunction(() => window.__soc.store.getState().actions.length > 0);
  await page.waitForFunction(() => window.__soc.store.getState().busy);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForFunction(() => window.__soc.store.getState().actions.length > 0);
  expect(errors).toEqual([]);
});

test('U-02 real board bot handoff uses the committed movement and can be cancelled during think', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await page.locator('.topbar select').selectOption('0.5');
  await page.evaluate(() => {
    void window.__soc.controller.clickTile({ x: 5, y: 4 });
    window.__soc.controller.setBotParty(true);
  });
  await page.waitForFunction(() => window.__soc.store.getState().actions.length >= 2);
  await page.getByTestId('bot-toggle').uncheck();
  const moves = await page.evaluate(() => window.__soc.store.getState().log.filter(line => line.text.startsWith('Jubal moves')).map(line => line.text));
  expect(moves[0]).toBe('Jubal moves 4 tiles to (5,4) (40 AP)');
  // The bot must plan from the committed position: whatever it does next, a further move has only 10 AP (1 tile) left.
  const second = await page.evaluate(() => window.__soc.store.getState().actions[1] as { type: string; unitId: string; to?: { x: number; y: number } });
  expect(second.unitId).toBe('jubal');
  if (second.type === 'move') expect(Math.max(Math.abs(second.to!.x - 5), Math.abs(second.to!.y - 4))).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.evaluate(() => {
    window.__soc.controller.setBotParty(true);
    window.__soc.controller.setBotParty(false);
  });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__soc.store.getState().actions.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('U-03 malformed shared loadout recovers with one toast and no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#e=wat&w=constructor&a=wat&s=Infinity&c=%%%');
  await expect(page.getByTestId('toast')).toContainText('defaults');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  expect(errors).toEqual([]);
});

test('U-10 same seed result returns after dismissal; U-09 report uses fight rules', async ({ page, context }) => {
  test.setTimeout(120000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page);
  await page.locator('.topbar select').selectOption('4');
  await page.getByTestId('bot-toggle').check();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Look at the board', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60000 });
  // Deliberately diverge future setup rules to ensure report reads the fight snapshot.
  await page.evaluate(() => window.__soc.controller.applyConfig({ ...window.__soc.store.getState().config, movementBudget: 80 }, false));
  await page.getByTestId('copy-report').click();
  await expect(page.getByTestId('toast')).toContainText('Report copied');
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).not.toContain('exact fight');
  expect(report).toContain('same setup and seed');
  const link = report.match(/https?:\/\/\S+/)![0];
  const fresh = await context.newPage();
  await fresh.goto(link);
  expect(await fresh.evaluate(() => window.__soc.store.getState().config.movementBudget)).toBe(50);
});
