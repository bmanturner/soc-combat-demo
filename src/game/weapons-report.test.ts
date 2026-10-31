import { expect, it, vi } from "vitest";
import { encounterById } from "../content/encounters";
import { WEAPONS } from "../content/gear";
import { DEFAULT_CONFIG } from "../rules/config";
import { applyAction, createBattle } from "../rules/engine";
import { fightReport } from "./report";
import { battleShareUrl, decodeShare } from "./share";

it("report and battle links preserve both starting weapons after a real swap", () => {
  vi.stubGlobal("location", { origin: "https://example.test", pathname: "/" });
  try {
    let b = createBattle(
      encounterById("wolves"),
      { weaponIds: ["crossbow", "shield"], equippedSlot: 0, armor: "light" },
      { ...DEFAULT_CONFIG, autoEndTurn: false },
      1,
    ).state;
    b = applyAction(b, { type: "swapWeapon", unitId: "jubal", slot: 1 }).state;
    const link = battleShareUrl(b);
    expect(decodeShare(link.split("#")[1]!)).toMatchObject({
      weaponId: "crossbow",
      secondaryWeaponId: "shield",
      equippedSlot: 0,
    });
    const text = fightReport(b);
    expect(text).toContain(WEAPONS.crossbow!.name);
    expect(text).toContain(WEAPONS.shield!.name);
    expect(text).toContain("reloads 0, swaps 1");
    expect(text).toContain("starting slot 1");
  } finally {
    vi.unstubAllGlobals();
  }
});
