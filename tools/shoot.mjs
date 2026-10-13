// Exploratory screenshots: node tools/shoot.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:5199/';
const out = process.argv[3] ?? '/home/needz/.hermes/cache/scratch/soc-shots';
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(base);
await page.waitForSelector('[data-testid=menu]');
await page.screenshot({ path: `${out}/01-menu.png` });
await page.click('[data-testid=enc-nephilim]');
await page.waitForSelector('[data-testid=setup]');
await page.click('[data-testid=weapon-daggers]');
await page.click('[data-testid=armor-light]');
await page.screenshot({ path: `${out}/02-setup.png` });
await page.click('[data-testid=start]');
await page.waitForSelector('[data-testid=battle]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/03-battle.png` });

// Hover a reachable tile toward the boss.
const box = await page.locator('[data-testid=board] canvas').boundingBox();
const info = await page.evaluate(() => {
  const s = window.__soc.store.getState();
  return { active: s.battle?.active?.unitId, w: s.battle?.map.width, h: s.battle?.map.height };
});
console.log('state', JSON.stringify(info));
if (box && info.w) {
  const tile = Math.min(Math.floor((box.width - 24) / info.w), Math.floor((box.height - 24) / info.h), 84);
  const ox = box.x + Math.floor((box.width - tile * info.w) / 2);
  const oy = box.y + Math.floor((box.height - tile * info.h) / 2);
  const at = (x, y) => [ox + x * tile + tile / 2, oy + y * tile + tile / 2];
  await page.mouse.move(...at(4, 4));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/04-hover-move.png` });
  await page.mouse.click(...at(4, 4));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/05-after-move.png` });
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
