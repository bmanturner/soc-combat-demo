import { describe, expect, it } from "vitest";
import { encounterById } from "../content/encounters";
import { DEFAULT_CONFIG } from "../rules/config";
import { createBattle } from "../rules/engine";
import {
  previewAttack,
  previewReload,
  previewSwap,
  projectedNextTurn,
} from "../rules/queries";
import { pendingFor } from "./preview";

describe("weapon UI projections", () => {
  it("reload and swap ghosts use shared next-turn helpers without a board hover", () => {
    const { state: b } = createBattle(
      encounterById("wolves"),
      { weaponIds: ["crossbow", "shield"], armor: "light" },
      DEFAULT_CONFIG,
      1,
    );
    const u = b.units.find((u) => u.id === "jubal")!;
    u.carried[0]!.loaded = false;
    const snapshot = structuredClone(b);
    for (const actionHover of ["reload", "swap"] as const) {
      const expected =
        actionHover === "reload" ? previewReload(b, u) : previewSwap(b, u, 1);
      const p = pendingFor({
        battle: b,
        hoverTile: null,
        mode: { kind: "move" },
        busy: false,
        actionHover,
      })!;
      expect(p.projected).toBe(expected.nextTurnIn);
      expect(p.extra).toBe(expected.apCost);
    }
    expect(b).toEqual(snapshot);
  });
  it("javelin alternate-mode ghost uses throw AP and never mutates RNG", () => {
    const { state: b } = createBattle(
      encounterById("wolves"),
      { weaponIds: ["javelin_shield", null], armor: "light" },
      DEFAULT_CONFIG,
      1,
    );
    const u = b.units.find((u) => u.id === "jubal")!,
      enemy = b.units.find((u) => u.side === "enemy")!;
    b.map.tiles.fill("floor");
    u.pos = { x: 4, y: 4 };
    enemy.pos = { x: 4, y: 2 };
    const snapshot = structuredClone(b),
      expected = previewAttack(b, u, enemy.pos, u.pos, "throw")!;
    const p = pendingFor({
      battle: b,
      hoverTile: enemy.pos,
      mode: { kind: "attack", modeId: "throw" },
      busy: false,
    })!;
    expect(p.extra).toBe(expected.apCost);
    expect(p.projected).toBe(projectedNextTurn(b, expected.apCost, true));
    expect(b).toEqual(snapshot);
  });
});
