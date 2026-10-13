import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../rules/config";
import { decodeShare, encodeShare } from "./share";

describe("two-slot share migration", () => {
  it("round trips both items and the starting slot", () => {
    const result = decodeShare(
      encodeShare({
        encounterId: "wolves",
        weaponId: "crossbow",
        secondaryWeaponId: "shield",
        equippedSlot: 1,
        config: DEFAULT_CONFIG,
      }),
    );
    expect(result).toMatchObject({
      weaponId: "crossbow",
      secondaryWeaponId: "shield",
      equippedSlot: 1,
    });
  });
  it("migrates legacy w links to an empty reserve", () => {
    expect(decodeShare("e=wolves&w=polearm")).toMatchObject({
      weaponId: "polearm",
      secondaryWeaponId: null,
      equippedSlot: 0,
    });
  });
  it("rejects tutorial reserves and empty starting slots", () => {
    expect(decodeShare("e=granary&w=daggers&w2=shield&slot=1")).toMatchObject({
      secondaryWeaponId: null,
      equippedSlot: 0,
      invalid: true,
    });
    expect(decodeShare("e=wolves&w=daggers&slot=1")).toMatchObject({
      equippedSlot: 0,
      invalid: true,
    });
  });
});
