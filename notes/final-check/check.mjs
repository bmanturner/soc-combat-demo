// Final integration spot-check: provenance rendering, setup catalog, boss telegraph, rules drawer search.
// node notes/final-check/check.mjs  (expects a preview server on :4192)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = '/home/needz/.hermes/cache/scratch/soc-final-check';
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4192/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const result = {};

await page.goto(base);
await page.waitForSelector('[data-testid=menu]');
await page.click('[data-testid=enc-wolves]');
await page.waitForSelector('[data-testid=setup]');
result.setupWeaponButtons = await page.locator('[data-testid^=weapon-]').count();
result.setupText = (await page.locator('[data-testid=setup]').innerText()).slice(0, 4000);
result.armorProvenance = (await page.locator('[data-testid^=armor-]').first().innerText());
await page.screenshot({ path: `${out}/01-wolves-setup.png`, fullPage: true });

await page.click('[data-testid=enc-granary]').catch(() => {});
await page.goto(base);
await page.click('[data-testid=enc-granary]');
result.granaryWeaponButtons = await page.locator('[data-testid^=weapon-]').count();

// Boss fight: bot plays until a telegraph is pending on a player turn.
await page.goto(base);
await page.click('[data-testid=enc-nephilim]');
await page.click('[data-testid=start]');
await page.waitForFunction(() => !!window.__soc?.tileCenter);
await page.locator('.topbar select').first().selectOption('4').catch(() => {});
await page.getByTestId('bot-toggle').check();
await page.waitForFunction(() => {
  const s = window.__soc.store.getState();
  return (s.battle?.effects.length ?? 0) > 0 || s.battle?.outcome !== 'ongoing';
}, null, { timeout: 90_000, polling: 30 });
await page.getByTestId('bot-toggle').uncheck();
await page.waitForFunction(() => {
  const s = window.__soc.store.getState();
  const b = s.battle;
  if (!b || b.outcome !== 'ongoing') return true;
  return b.units.find((u) => u.id === b.active?.unitId)?.side === 'player' && !s.busy;
}, null, { timeout: 60_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/02-boss-telegraph.png` });
// Hover an enemy to open the inspect card (unit provenance).
const boss = await page.evaluate(() => window.__soc.store.getState().battle.units.find((u) => u.ai === 'nephilim')?.pos);
const box = await page.locator('[data-testid=board] canvas').boundingBox();
const c = await page.evaluate(([x, y]) => window.__soc.tileCenter(x, y), [boss.x, boss.y]);
await page.mouse.move(box.x + c.x, box.y + c.y);
await page.waitForTimeout(400);
result.inspectText = await page.locator('.panel.left').innerText();
await page.screenshot({ path: `${out}/03-boss-inspect.png` });

// Rules drawer search.
await page.getByTestId('open-settings').click();
await page.waitForSelector('[data-testid=settings]');
const search = page.locator('[data-testid=settings] input[type=search], [data-testid=settings] input[placeholder*="earch"]').first();
await search.fill('sweep');
await page.waitForTimeout(300);
result.drawerVisibleRows = await page.locator('[data-testid^=setting-]:visible').count();
await page.screenshot({ path: `${out}/04-rules-search.png` });
result.errors = errors;
writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, setupText: result.setupText.slice(0, 600), inspectText: result.inspectText.slice(0, 900) }, null, 2));
await browser.close();
