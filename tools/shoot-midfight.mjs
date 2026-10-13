// Mid-fight screenshots: let the bot play until a telegraph is pending on a player turn, then hand control back.
// node tools/shoot-midfight.mjs <encounter> <weapon> <armor> [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [enc = 'nephilim', weapon = 'daggers', armor = 'light', out = '/home/needz/.hermes/cache/scratch/soc-shots'] = process.argv.slice(2);
const base = 'http://127.0.0.1:4173/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base);
await page.getByTestId(`enc-${enc}`).click();
await page.getByTestId(`weapon-${weapon}`).click();
if (armor !== '-') await page.getByTestId(`armor-${armor}`).click();
await page.getByTestId('start').click();
await page.waitForFunction(() => !!window.__soc.tileCenter);
await page.evaluate(() => { window.__soc.controller.setSpeed(4); window.__soc.controller.setBotParty(true); });
// Stop the bot as soon as something is telegraphed.
await page.waitForFunction(() => {
  const s = window.__soc.store.getState();
  if ((s.battle?.effects.length ?? 0) > 0 || s.battle?.outcome !== 'ongoing') { if (s.botParty) window.__soc.controller.setBotParty(false); return true; }
  return false;
}, null, { timeout: 90_000, polling: 30 });
await page.waitForFunction(() => {
  const s = window.__soc.store.getState();
  const b = s.battle;
  if (!b || b.outcome !== 'ongoing') return true;
  const u = b.units.find((x) => x.id === b.active?.unitId);
  return u?.side === 'player' && !s.busy;
}, null, { timeout: 60_000 });
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const b = window.__soc.store.getState().battle;
  const u = b.units.find((x) => x.id === b.active?.unitId);
  return { outcome: b.outcome, clock: b.clock, active: u?.id, pos: u?.pos, effects: b.effects.map((e) => ({ name: e.name, at: e.resolveAt, n: e.tiles.length })), units: b.units.map((x) => `${x.id}@${x.pos.x},${x.pos.y} ${x.hp}hp`) };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: `${out}/${enc}-telegraph.png` });

// Hover the tile under each enemy adjacent-ish to get an attack preview, and a far tile for a move preview.
const canvas = page.locator('[data-testid=board] canvas');
const box = await canvas.boundingBox();
if (info.pos) {
  const target = await page.evaluate(() => {
    const b = window.__soc.store.getState().battle;
    const u = b.units.find((x) => x.id === b.active?.unitId);
    const foes = b.units.filter((x) => x.side === 'enemy' && !x.ko);
    foes.sort((a, c) => Math.max(Math.abs(a.pos.x - u.pos.x), Math.abs(a.pos.y - u.pos.y)) - Math.max(Math.abs(c.pos.x - u.pos.x), Math.abs(c.pos.y - u.pos.y)));
    return foes[0]?.pos;
  });
  if (target) {
    const c = await page.evaluate(([x, y]) => window.__soc.tileCenter(x, y), [target.x, target.y]);
    await page.mouse.move(box.x + c.x, box.y + c.y);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${enc}-hover-enemy.png` });
  }
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
