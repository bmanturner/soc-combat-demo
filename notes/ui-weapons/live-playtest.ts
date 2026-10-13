import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { PLAYER_WEAPON_IDS } from "../../src/content/gear";
import { attackOptions, reachable } from "../../src/rules/queries";
import type { BattleState } from "../../src/rules/types";

const out = "/home/needz/.hermes/cache/scratch/soc-ui-weapons";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results: { weapon: string; actions: number; pageerrors: string[] }[] = [];
try {
  for (const id of PLAYER_WEAPON_IDS) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 950 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:4185/#e=wolves&w=${id}`);
    await page.getByTestId("start").click();
    await page.waitForFunction(() => !!window.__soc.tileCenter);
    await page.locator(".topbar select").selectOption("4");
    const click = async (x: number, y: number, commit = true) => {
      const box = (await page
        .locator("[data-testid=board] canvas")
        .boundingBox())!;
      const p = await page.evaluate(
        ([x, y]) => window.__soc.tileCenter!(x!, y!),
        [x, y],
      );
      await page.mouse.move(box.x + p.x, box.y + p.y);
      if (commit) await page.mouse.click(box.x + p.x, box.y + p.y);
    };
    let performed = false;
    for (let turn = 0; turn < 24 && !performed; turn++) {
      await page.waitForFunction(() => {
        const s = window.__soc.store.getState();
        return (
          !s.busy &&
          s.battle?.active &&
          s.battle.units.find((u) => u.id === s.battle!.active!.unitId)
            ?.side === "player"
        );
      });
      const b: BattleState = await page.evaluate(
        () => window.__soc.store.getState().battle!,
      );
      const u = b.units.find((u) => u.id === b.active!.unitId)!;
      if (u.id !== "jubal" || b.active!.acted) {
        await page.getByTestId("end-turn").click();
        continue;
      }
      const wanted =
        id === "javelin_shield"
          ? "throw"
          : id === "colossal"
            ? "sweep"
            : undefined;
      const options = attackOptions(b, u).filter(
        (p) => !wanted || p.modeId === wanted,
      );
      if (options.length) {
        const attack = options[0]!;
        await page.keyboard.press("a");
        if (wanted === "throw") await page.getByTestId("mode-throw").click();
        if (wanted === "sweep") await page.keyboard.press("t");
        await click(attack.anchor.x, attack.anchor.y, false);
        await page.screenshot({ path: `${out}/${id}-live-encounter.png` });
        await click(attack.anchor.x, attack.anchor.y);
        await page.waitForFunction(() =>
          window.__soc.store
            .getState()
            .actions.some((a) => a.type === "attack" && a.unitId === "jubal"),
        );
        performed = true;
      } else {
        const move = [...reachable(b, u.id).values()].find(
          (r) =>
            r.path.length > 1 &&
            attackOptions(b, u, r.path.at(-1)!).some(
              (p) => !wanted || p.modeId === wanted,
            ),
        );
        if (move) {
          await page.keyboard.press("m");
          const p = move.path.at(-1)!;
          await click(p.x, p.y);
        } else await page.getByTestId("end-turn").click();
      }
    }
    if (!performed) throw new Error(`No real encounter attack for ${id}`);
    if (errors.length) throw new Error(errors.join("\n"));
    results.push({
      weapon: id,
      actions: await page.evaluate(
        () => window.__soc.store.getState().actions.length,
      ),
      pageerrors: errors,
    });
    await page.close();
  }
  writeFileSync(`${out}/live-playtest.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
