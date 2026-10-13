import { test, expect, type Page } from '@playwright/test';
import { PLAYER_WEAPON_IDS } from '../src/content/gear';
import { SETTINGS } from '../src/rules/config';
import { previewAttack } from '../src/rules/queries';
import { attackModes } from '../src/rules/equipment';

async function state(page: Page) { return page.evaluate(() => window.__soc.store.getState()); }
async function ready(page: Page) {
  await page.waitForFunction(() => { const s = window.__soc.store.getState(); return !s.busy && s.battle?.units.find(u => u.id === s.battle?.active?.unitId)?.side === 'player'; });
}
async function start(page: Page, weapon: string) {
  await page.goto('/');
  await page.goto(`/#e=wolves&w=${weapon}`);
  await page.getByTestId('start').click();
  await page.getByRole('combobox').selectOption('4');
  await ready(page);
}

test('X-01 sweep selection, hover, skills and T are pure; board click commits query AP', async ({ page }) => {
  await start(page, 'colossal');
  for (let i = 0; i < 16; i++) {
    const b = (await state(page)).battle!, u = b.units.find(u => u.id === 'jubal')!;
    if (b.active?.unitId === u.id && previewAttack(b, u, u.pos, u.pos, 'sweep')) break;
    await page.getByTestId('end-turn').click(); await ready(page);
  }
  const before = (await state(page)).battle!, u = before.units.find(u => u.id === 'jubal')!;
  const expected = previewAttack(before, u, u.pos, u.pos, 'sweep')!;
  expect(expected).toBeTruthy();
  const originalMode = (await state(page)).mode;
  await page.getByTestId('mode-sweep').hover();
  expect((await state(page)).mode).toEqual(originalMode);
  await page.getByTestId('mode-sweep').click();
  await expect(page.getByTestId('card-jubal')).toContainText('Ring:');
  await expect(page.getByTestId('card-jubal')).toContainText(`${expected.apCost} AP`);
  await page.keyboard.press('t'); await page.keyboard.press('t');
  for (const skill of await page.locator('.skill-rows button:enabled').all()) await skill.click();
  await page.getByTestId('mode-sweep').click();
  expect((await state(page)).battle).toEqual(before);
  const box = (await page.locator('[data-testid=board] canvas').boundingBox())!;
  const p = await page.evaluate(pos => window.__soc.tileCenter!(pos.x, pos.y), u.pos);
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await page.waitForFunction(() => !window.__soc.store.getState().busy && window.__soc.store.getState().actions.some(a => a.type === 'attack'));
  expect((await state(page)).battle!.active!.actionSpent).toBe(expected.apCost);
});

test('X-01 every weapon mode and enabled skill button selects without executing', async ({ page }) => {
  for (const weapon of PLAYER_WEAPON_IDS) {
    await start(page, weapon);
    const before = (await state(page)).battle;
    for (const button of await page.locator('[data-testid^="mode-"], .skill-rows button:enabled').all()) {
      await button.hover(); await button.click();
      expect((await state(page)).battle).toEqual(before);
    }
    for (let i = 0; i < 3; i++) await page.keyboard.press('t');
    expect((await state(page)).battle).toEqual(before);
  }
});

test('X-02 report reopens after looking at board', async ({ page }) => {
  await page.goto('/#e=granary'); await page.getByTestId('start').click();
  await page.getByRole('combobox').selectOption('4'); await page.getByTestId('bot-toggle').check();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 90000 });
  await page.getByRole('button', { name: 'Look at the board', exact: true }).click();
  await page.getByTestId('reopen-results').click();
  await expect(page.getByTestId('copy-report')).toBeVisible();
});

test('X-03 same-tab setup loads; ongoing fight confirms and cancel restores URL', async ({ page }) => {
  await page.goto('/'); await page.goto('/#e=wolves&w=crossbow&s=33');
  await expect(page.getByTestId('setup')).toBeVisible();
  expect((await state(page)).seed).toBe(33);
  await page.getByTestId('start').click();
  const original = page.url();
  page.once('dialog', d => d.dismiss()); await page.goto('/#e=granary&s=2');
  await expect.poll(() => page.url()).toBe(original);
  expect((await state(page)).encounterId).toBe('wolves');
  page.once('dialog', d => d.accept()); await page.goto('/#e=granary&s=2');
  await expect(page.getByTestId('setup')).toBeVisible();
  expect((await state(page)).seed).toBe(2);
  expect((await state(page)).battle).toBeNull();
});

test('X-04/X-07 rules search, changed filter, row reset, named and described controls', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Rules & settings', exact: true }).click();
  for (const def of SETTINGS) {
    const control = page.locator(`#rule-${def.key}`);
    await expect(control).toHaveAccessibleName(def.label);
    await expect(control).toHaveAccessibleDescription(def.why);
  }
  await page.getByRole('searchbox', { name: 'Search rules' }).fill('weaponSwapAp');
  await expect(page.locator('.setting')).toHaveCount(1);
  const input = page.locator('#rule-weaponSwapAp');
  await input.focus(); await page.keyboard.press('ArrowRight');
  await page.getByLabel('Changed only', { exact: true }).check();
  await expect(page.locator('.setting')).toHaveCount(1);
  await page.getByTestId('setting-weaponSwapAp').getByRole('button', { name: /^Reset / }).click();
  await expect(page.locator('.setting')).toHaveCount(0);
  await expect(page.getByTestId('settings')).toContainText('0 changed');
});

test('X-08 selected throw and dual wield summaries have shape and query stats', async ({ page }) => {
  await start(page, 'javelin_shield');
  await page.getByTestId('mode-throw').click();
  const b = (await state(page)).battle!, u = b.units.find(u => u.id === 'jubal')!;
  const m = attackModes(b, u).find(m => m.id === 'throw')!;
  await expect(page.getByTestId('card-jubal')).toContainText(`${m.apCost} AP`);
  await expect(page.getByTestId('card-jubal')).toContainText(`range ${m.range!.join('–')}`);
  await expect(page.getByTestId('card-jubal').getByRole('img')).toHaveAccessibleName(/throw.*ranged/i);
  await start(page, 'dual_wield');
  await expect(page.getByTestId('card-jubal')).toContainText('Primary + one random secondary');
});

test('X-06 first lesson is skippable and ghost legend persists', async ({ page }) => {
  await page.goto('/#e=granary'); await page.getByTestId('start').click();
  await expect(page.getByTestId('granary-guide')).toContainText('1 · Move');
  await page.getByRole('button', { name: 'Skip guidance' }).click();
  await expect(page.getByTestId('granary-guide')).toHaveCount(0);
  await expect(page.getByTestId('timeline')).toContainText('Dashed ghost = your next turn');
});
