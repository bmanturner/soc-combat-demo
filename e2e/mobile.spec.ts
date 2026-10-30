import { expect, test, type Page } from '@playwright/test';

type Soc = {
  store: { getState: () => Record<string, unknown> & { actions: { type: string }[]; battle: { units: { id: string; pos: { x: number; y: number } }[] } | null } };
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

async function start(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __soc: Soc }).__soc.tileCenter);
}

async function tapTile(page: Page, x: number, y: number) {
  const box = (await page.locator('[data-testid=board] canvas').first().boundingBox())!;
  const c = await page.evaluate(([tx, ty]) => (window as unknown as { __soc: Soc }).__soc.tileCenter!(tx!, ty!), [x, y]);
  await page.touchscreen.tap(box.x + c.x, box.y + c.y);
}

const jubalPos = (page: Page) => page.evaluate(() => (window as unknown as { __soc: Soc }).__soc.store.getState().battle!.units.find((u) => u.id === 'jubal')!.pos);
const actions = (page: Page) => page.evaluate(() => (window as unknown as { __soc: Soc }).__soc.store.getState().actions);

async function box(page: Page, testId: string) {
  return (await page.getByTestId(testId).boundingBox())!;
}

/** The first tap on (4,4) previews the 40 AP move without committing; the second tap commits it. */
async function twoTapMove(page: Page) {
  await tapTile(page, 4, 4);
  await expect(page.getByTestId('ghost-text')).toContainText('next turn in 40');
  expect(await jubalPos(page)).toEqual({ x: 4, y: 8 });
  expect(await actions(page)).toHaveLength(0);
  await tapTile(page, 4, 4);
  await expect(page.getByTestId('log')).toContainText('Jubal moves 4 tiles to (4,4) (40 AP)');
  expect(await jubalPos(page)).toEqual({ x: 4, y: 4 });
}

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test('battle fits the screen with the board, timeline and End turn visible', async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, '#e=nephilim&w=daggers&a=light');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect((await box(page, 'board')).height).toBeGreaterThanOrEqual(280);
    for (const id of ['timeline', 'board', 'tab-actions', 'end-turn']) {
      const b = await box(page, id);
      expect(b.y, id).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, id).toBeLessThanOrEqual(664);
    }
    await expect(page.getByTestId('open-settings')).toBeHidden();
    await page.getByTestId('topbar-menu').tap();
    await expect(page.getByTestId('open-settings')).toBeVisible();
    await page.getByTestId('open-settings').tap();
    await expect(page.getByTestId('settings')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('2D board: a tap previews, a second tap commits', async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, '#e=nephilim&w=daggers&a=light');
    await twoTapMove(page);
    expect(errors).toEqual([]);
  });

  test('3D board: a tap previews, a second tap commits', async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, '#e=nephilim&w=daggers&a=light');
    await page.getByTestId('topbar-menu').tap();
    await page.getByTestId('view-3d').tap();
    await expect(page.locator('canvas.board3d-canvas')).toBeVisible();
    await page.waitForFunction(() => !!(window as unknown as { __soc: Soc }).__soc.tileCenter);
    await twoTapMove(page);
    expect(errors).toEqual([]);
  });

  test('Swap previews on the first tap and commits on the second', async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, '#e=wolves&w=daggers&w2=shield&a=clothing');
    await page.getByTestId('swap').tap();
    await expect(page.getByTestId('ghost-text')).toContainText('Swap');
    expect(await actions(page)).toHaveLength(0);
    await page.getByTestId('swap').tap();
    await expect.poll(async () => (await actions(page)).at(-1)?.type).toBe('swapWeapon');
    expect(errors).toEqual([]);
  });
});

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('board fills the left column and the HUD column keeps End turn on screen', async ({ page }) => {
    const errors = watchErrors(page);
    await start(page, '#e=nephilim&w=daggers&a=light');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
    const board = await box(page, 'board');
    const timeline = await box(page, 'timeline');
    expect(board.x).toBeLessThan(2);
    expect(board.height).toBeGreaterThanOrEqual(380);
    expect(board.x + board.width).toBeLessThanOrEqual(timeline.x);
    const end = await box(page, 'end-turn');
    expect(end.x).toBeGreaterThanOrEqual(0);
    expect(end.y).toBeGreaterThanOrEqual(0);
    expect(end.x + end.width).toBeLessThanOrEqual(844);
    expect(end.y + end.height).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
});
