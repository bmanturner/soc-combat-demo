import { expect, test, type Page } from '@playwright/test';
import type { controller } from '../src/game/controller';
import type { store } from '../src/game/store';

interface Box { x: number; y: number; width: number; height: number }
interface UnitBounds extends Box { id: string; body: Box | null; plate: Box }

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

async function open3d(page: Page, encounter: string) {
  // A hash-only navigation keeps the running app; start from a blank page so each encounter loads fresh.
  await page.goto('about:blank');
  await page.goto(`/#e=${encounter}`);
  await page.getByTestId('start').click();
  if ((await page.getByTestId('view-3d').getAttribute('aria-pressed')) !== 'true') await page.getByTestId('view-3d').click();
  await page.waitForFunction(() => !!window.__soc.tileCenter);
  await page.waitForTimeout(500);
}

const unitBounds = (page: Page): Promise<UnitBounds[]> =>
  page.evaluate(() => {
    // Test hook set by the 3D board; the shared Window declaration (all specs must match) omits it.
    const hooks = window.__soc as unknown as { labelBounds: () => { units: UnitBounds[] } };
    return hooks.labelBounds().units;
  });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('3D board: unit tags never cover another unit at the default camera', async ({ page }) => {
  for (const encounter of ['granary', 'rat_nest', 'wolves', 'bandits', 'cultists', 'valley_bandits', 'nephilim']) {
    await open3d(page, encounter);
    const units = await unitBounds(page);
    const hits = units.flatMap((a) => units.filter((b) => a !== b && b.body && overlaps(a.plate, b.body)).map((b) => ({ tag: a.id, covers: b.id, plate: a.plate, body: b.body })));
    expect(hits, `${encounter}: ${JSON.stringify(hits)}`).toEqual([]);
    for (const u of units.filter((u) => u.id !== 'nephilim')) expect(u.plate.height, `${encounter}/${u.id}`).toBeLessThanOrEqual(28);
  }
});

test('summoned rats get tokens on both boards', async ({ page }) => {
  const errors = watchErrors(page);
  for (const view of ['view-2d', 'view-3d']) {
    await page.goto('about:blank');
    await page.goto('/#e=rat_nest');
    await page.getByTestId('start').click();
    if ((await page.getByTestId(view).getAttribute('aria-pressed')) !== 'true') await page.getByTestId(view).click();
    await page.waitForFunction(() => !!window.__soc.tileCenter);
    await page.evaluate(() => window.__soc.controller.setBotParty(true));
    await page.waitForFunction(() => window.__soc.store.getState().battle!.units.length > 5);
    await page.evaluate(() => window.__soc.controller.setBotParty(false));
    await page.waitForFunction(() => {
      const s = window.__soc.store.getState();
      const b = s.battle!;
      return !s.busy && !!b.active && b.units.find((u) => u.id === b.active!.unitId)!.side === 'player';
    });
    const { alive, drawn } = await page.evaluate(() => {
      // Test hook set by both boards; the shared Window declaration (all specs must match) omits it.
      const hooks = window.__soc as unknown as { labelBounds: () => { units: { id: string }[] } };
      return { alive: window.__soc.store.getState().battle!.units.filter((u) => !u.ko).map((u) => u.id), drawn: hooks.labelBounds().units.map((u) => u.id) };
    });
    expect(drawn, view).toEqual(expect.arrayContaining(alive));
  }
  expect(errors).toEqual([]);
});

test('3D board: tags keep their screen size when zooming', async ({ page }) => {
  await open3d(page, 'granary');
  const jubal = async () => (await unitBounds(page)).find((u) => u.id === 'jubal')!;
  const before = await jubal();
  const box = (await page.locator('[data-testid=board] canvas.board3d-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
  const after = await jubal();
  expect(after.body!.height).toBeGreaterThanOrEqual(before.body!.height * 1.2);
  expect(Math.abs(after.plate.height - before.plate.height)).toBeLessThanOrEqual(1);
});

test('3D board: outline toggle renders without errors and persists', async ({ page }) => {
  const errors = watchErrors(page);
  await start3d(page);
  await page.getByTestId('board3d-outlines').click();
  await expect(page.getByTestId('board3d-outlines')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByTestId('start').click();
  await page.locator('canvas.board3d-canvas').waitFor();
  await expect(page.getByTestId('board3d-outlines')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
