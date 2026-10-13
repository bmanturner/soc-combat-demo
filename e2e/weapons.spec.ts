import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { PLAYER_WEAPON_IDS, WEAPONS } from "../src/content/gear";
import {
  previewAttack,
  previewReload,
  previewSwap,
} from "../src/rules/queries";
import type { controller } from "../src/game/controller";
import type { store } from "../src/game/store";
declare global {
  interface Window {
    __soc: {
      store: typeof store;
      controller: typeof controller;
      tileCenter?: (x: number, y: number) => { x: number; y: number };
    };
  }
}
const artifacts = process.env.WEAPON_SCREENSHOTS;
async function shot(page: Page, name: string) {
  if (artifacts) {
    mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
  }
}
async function point(page: Page, x: number, y: number) {
  const box = (await page.locator("[data-testid=board] canvas").boundingBox())!;
  const p = await page.evaluate(
    ([x, y]) => window.__soc.tileCenter!(x!, y!),
    [x, y],
  );
  return { x: box.x + p.x, y: box.y + p.y };
}
async function arrange(page: Page, ranged: boolean) {
  await page.evaluate((ranged) => {
    const s = window.__soc.store.getState(),
      b = structuredClone(s.battle!);
    b.map.tiles = b.map.tiles.map(() => "floor");
    let enemy = 0;
    for (const u of b.units) {
      if (u.id === "jubal") u.pos = { x: 4, y: 4 };
      else {
        u.nextTurnAt = b.clock + 10000;
        if (u.side === "enemy") {
          u.pos = [
            { x: 4, y: ranged ? 2 : 3 },
            b.units.find(unit => unit.id === 'jubal')?.weaponId === 'polearm' ? {x:4,y:2} : { x: 5, y: 3 },
            { x: 3, y: 3 },
            { x: 7, y: 1 },
            { x: 7, y: 2 },
          ][enemy++] ?? { x: 8, y: enemy };
          u.hp = u.maxHp = 10000;
        } else u.pos = { x: 1, y: 1 };
      }
    }
    window.__soc.store.setState({
      battle: b,
      boardVersion: s.boardVersion + 1,
    });
  }, ranged);
}
for (const id of PLAYER_WEAPON_IDS)
  test(`W2 ${id}: distinctive action, pure preview and AP parity`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#e=wolves");
    await expect(page.locator('[data-testid^="weapon-"]')).toHaveCount(9);
    await page.getByTestId(`weapon-${id}`).click();
    await shot(page, `${id}-setup`);
    await page.getByTestId("edit-secondary").click();
    await page.getByTestId("weapon-shield").click();
    await page.evaluate(() =>
      window.__soc.controller.applyConfig(
        {
          ...window.__soc.store.getState().config,
          autoEndTurn: false,
          reactionsEnabled: false,
        },
        false,
      ),
    );
    await page.getByTestId("start").click();
    await page.waitForFunction(() => !!window.__soc.tileCenter);
    await arrange(
      page,
      ["hunting_bow", "crossbow", "javelin_shield"].includes(id),
    );
    const modeId =
      id === "javelin_shield"
        ? "throw"
        : id === "colossal"
          ? "sweep"
          : WEAPONS[id]!.modes[0]!.id;
    await page.keyboard.press("a");
    if (id === "javelin_shield") await page.getByTestId("mode-throw").click();
    if (id === "colossal") await page.keyboard.press("t");
    const target =
      id === "colossal"
        ? { x: 4, y: 4 }
        : {
            x: 4,
            y: ["hunting_bow", "crossbow", "javelin_shield"].includes(id)
              ? 2
              : 3,
          };
    const before = await page.evaluate(
      () => window.__soc.store.getState().battle!,
    );
    const expected = previewAttack(
      before,
      before.units.find((u) => u.id === "jubal")!,
      target,
      undefined,
      modeId,
    )!;
    expect(expected).not.toBeNull();
    if (['shield','polearm','two_handed','colossal'].includes(id)) expect(expected.targets.length).toBeGreaterThan(1);
    if (id === 'dual_wield') { expect(expected.targets).toHaveLength(1); expect(expected.candidates!.length).toBeGreaterThan(1); }
    if (['daggers','hunting_bow','crossbow','javelin_shield'].includes(id)) expect(expected.targets).toHaveLength(1);
    const p = await point(page, target.x, target.y);
    await page.mouse.move(p.x, p.y);
    await expect(page.getByTestId("attack-preview")).toContainText(
      `${expected.apCost} AP`,
    );
    if (id === "dual_wield")
      await expect(page.getByTestId("attack-preview")).toContainText(
        "one random",
      );
    expect(
      await page.evaluate(() => window.__soc.store.getState().battle),
    ).toEqual(before);
    await shot(page, `${id}-preview`);
    if (artifacts)
      await page
        .locator(".panel.left")
        .screenshot({ path: `${artifacts}/${id}-action-panel.png` });
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(
      () =>
        !window.__soc.store.getState().busy &&
        window.__soc.store.getState().actions.some((a) => a.type === "attack"),
    );
    expect(
      await page.evaluate(
        () => window.__soc.store.getState().battle!.active!.actionSpent,
      ),
    ).toBe(expected.apCost);
    await expect(page.getByTestId("log")).toContainText("Jubal");
    if (id === "crossbow") {
      await expect(page.getByTestId("weapon-slots")).toContainText("Unloaded");
      await page.getByTestId("end-turn").click();
      await page.waitForFunction(
        () =>
          !window.__soc.store.getState().busy &&
          !window.__soc.store.getState().battle!.active!.acted,
      );
      const b = await page.evaluate(
        () => window.__soc.store.getState().battle!,
      );
      const reload = previewReload(
        b,
        b.units.find((u) => u.id === "jubal")!,
      );
      await page.getByTestId("reload").hover();
      await expect(page.getByTestId("ghost-text")).toContainText(
        String(reload.nextTurnIn),
      );
      await page.keyboard.press("r");
      await page.waitForFunction(
        () =>
          window.__soc.store.getState().battle!.telemetry.jubal!.reloads === 1,
      );
      await expect(page.getByTestId("weapon-slots")).toContainText("Loaded");
      await expect(page.getByTestId("log")).toContainText(/reload/i);
    }
    await page.getByTestId("end-turn").click();
    await page.waitForFunction(
      () =>
        !window.__soc.store.getState().busy &&
        !window.__soc.store.getState().battle!.active!.acted,
    );
    const b = await page.evaluate(() => window.__soc.store.getState().battle!);
    const swap = previewSwap(
      b,
      b.units.find((u) => u.id === "jubal")!,
      1,
    );
    await page.getByTestId("swap").hover();
    await expect(page.getByTestId("ghost-text")).toContainText(
      String(swap.nextTurnIn),
    );
    await page.keyboard.press("w");
    await page.waitForFunction(
      () => window.__soc.store.getState().battle!.telemetry.jubal!.swaps === 1,
    );
    expect(
      await page.evaluate(
        () =>
          window.__soc.store
            .getState()
            .battle!.units.find((u) => u.id === "jubal")!.equippedSlot,
      ),
    ).toBe(1);
    await expect(page.getByTestId("swap")).toBeDisabled();
    expect(errors).toEqual([]);
  });

test("W2 strict reload reasons and overlay shortcuts use the engine gates", async ({
  page,
}) => {
  await page.goto("/#e=wolves&w=crossbow&w2=shield");
  await page.evaluate(() =>
    window.__soc.controller.applyConfig(
      {
        ...window.__soc.store.getState().config,
        crossbowReload: "strict",
        proficientAllWeapons: false,
        autoEndTurn: false,
      },
      false,
    ),
  );
  await page.getByTestId("start").click();
  await page.waitForFunction(() => !!window.__soc.tileCenter);
  await arrange(page, true);
  await page.keyboard.press("a");
  const p = await point(page, 4, 2);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(
    () =>
      !window.__soc.store.getState().busy &&
      window.__soc.store.getState().battle!.active!.acted,
  );
  await page.getByTestId("end-turn").click();
  await page.waitForFunction(
    () =>
      !window.__soc.store.getState().busy &&
      !window.__soc.store.getState().battle!.active!.acted,
  );
  await expect(page.getByTestId("swap")).toBeDisabled();
  await expect(page.getByTestId("swap")).toHaveAttribute(
    "title",
    "must reload before another combat action",
  );
  await expect(page.getByTestId("turn-box")).toContainText(
    "Requires Soldier / Savage / Rogue weapon proficiency",
  );
  await page.getByRole("button", { name: "?", exact: true }).click();
  const before = await page.evaluate(
    () => window.__soc.store.getState().actions.length,
  );
  for (const key of ["r", "w", "t", "1", "Space"])
    await page.keyboard.press(key);
  expect(
    await page.evaluate(() => window.__soc.store.getState().actions.length),
  ).toBe(before);
  await page.keyboard.press("Escape");
  await page.keyboard.press("r");
  await page.waitForFunction(
    () => window.__soc.store.getState().battle!.telemetry.jubal!.reloads === 1,
  );
});

test("W2 secondary starting slot survives the UI share round trip", async ({
  page,
  context,
}) => {
  await page.goto("/#e=wolves");
  await page.getByTestId("weapon-crossbow").click();
  await page.getByTestId("edit-secondary").click();
  await page.getByTestId("weapon-shield").click();
  await page.getByLabel("Start equipped").selectOption("1");
  await page.getByTestId("start").click();
  const fresh = await context.newPage();
  await fresh.goto(page.url());
  await expect(fresh.getByLabel("Start equipped")).toHaveValue("1");
  await fresh.getByTestId("start").click();
  expect(
    await fresh.evaluate(() => window.__soc.store.getState().battle!.setup),
  ).toMatchObject({ weaponIds: ["crossbow", "shield"], equippedSlot: 1 });
});

test("W2 Granary has four single-slot starters; locks explain source combinations", async ({
  page,
}) => {
  await page.goto("/#e=granary");
  await expect(page.locator('[data-testid^="weapon-"]')).toHaveCount(4);
  await expect(page.getByTestId("edit-secondary")).toHaveCount(0);
  await page.goto("/");
  await page.getByTestId("enc-wolves").click();
  await page.evaluate(() =>
    window.__soc.controller.applyConfig(
      {
        ...window.__soc.store.getState().config,
        unlockSpecialWeapons: false,
        proficientAllWeapons: false,
      },
      false,
    ),
  );
  for (const id of ["colossal", "javelin_shield", "dual_wield"])
    await expect(page.getByTestId(`weapon-${id}`)).toBeDisabled();
  await expect(page.getByTestId("weapon-colossal")).toContainText(
    "Juggernaut: Soldier + Savage",
  );
  await expect(page.getByTestId("weapon-daggers")).toContainText("proficiency");
});
