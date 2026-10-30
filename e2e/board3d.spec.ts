import { expect, test, type Page } from '@playwright/test';
import type { controller } from '../src/game/controller';
import type { store } from '../src/game/store';

declare global { interface Window { __soc: { store: typeof store; controller: typeof controller; tileCenter?: (x: number, y: number) => { x: number; y: number } }; } }

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function start3d(page: Page) {
  await page.goto('/#e=granary');
  await page.getByTestId('start').click();
  await page.getByTestId('view-3d').click();
  await page.locator('[data-testid=board] canvas.board3d-canvas').waitFor();
  await page.waitForFunction(() => !!window.__soc.tileCenter);
}

async function point(page: Page, x: number, y: number) {
  const box = (await page.locator('[data-testid=board] canvas').boundingBox())!;
  const p = await page.evaluate(([tx, ty]) => window.__soc.tileCenter!(tx!, ty!), [x, y]);
  return { x: box.x + p.x, y: box.y + p.y };
}

test('3D board: a drag orbits without committing; a click in place moves', async ({ page }) => {
  const errors = watchErrors(page);
  await start3d(page);
  const from = await page.evaluate(() => {
    const b = window.__soc.store.getState().battle!;
    return b.units.find((u) => u.id === b.active!.unitId)!.pos;
  });
  const target = { x: from.x, y: from.y - 1 };

  const a = await point(page, target.x, target.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 120, a.y - 20, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__soc.store.getState().actions.length)).toBe(0);

  await page.getByTestId('board3d-reset').click();
  await page.waitForTimeout(400); // orbit damping settles
  const c = await point(page, target.x, target.y);
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => !window.__soc.store.getState().busy && window.__soc.store.getState().actions.length === 1);
  const after = await page.evaluate(() => {
    const s = window.__soc.store.getState();
    return { action: s.actions[0], pos: s.battle!.units.find((u) => u.id === s.actions[0]!.unitId)!.pos };
  });
  expect(after.action).toMatchObject({ type: 'move', to: target });
  expect(after.pos).toEqual(target);
  expect(errors).toEqual([]);
});

test('switching board view mid-animation commits the action and the choice persists', async ({ page }) => {
  const errors = watchErrors(page);
  await start3d(page);
  await page.evaluate(() => { window.__soc.controller.setSpeed(0.5); window.__soc.controller.setBotParty(true); });
  await page.waitForFunction(() => window.__soc.store.getState().busy);
  const before = await page.evaluate(() => window.__soc.store.getState().actions.length);
  await page.getByTestId('view-2d').click();
  await page.waitForFunction((n) => window.__soc.store.getState().actions.length > n, before);
  await page.getByTestId('view-3d').click();
  await page.locator('canvas.board3d-canvas').waitFor();
  await page.evaluate(() => window.__soc.controller.setBotParty(false));
  await page.waitForFunction(() => !window.__soc.store.getState().busy);

  await page.reload();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('view-3d')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('canvas.board3d-canvas').waitFor();
  expect(errors).toEqual([]);
});
