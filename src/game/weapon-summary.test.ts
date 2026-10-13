import { describe, it, expect } from 'vitest';
import { createBattle } from '../rules/engine';
import { encounterById } from '../content/encounters';
import { PLAYER_WEAPON_IDS } from '../content/gear';
import { DEFAULT_CONFIG } from '../rules/config';
import { attackModes } from '../rules/equipment';
import { selectedWeaponMode, PATTERN_TEXT } from './weapon-summary';

describe('selected weapon summary', () => {
  for (const weaponId of PLAYER_WEAPON_IDS) it(`${weaponId}: all modes have descriptions and query-derived values`, () => {
    const { state: b } = createBattle(encounterById('wolves'), { weaponIds: [weaponId, null], armor: 'light' }, DEFAULT_CONFIG, 1);
    const u = b.units.find(u => u.id === 'jubal')!;
    const before = structuredClone(b);
    for (const m of attackModes(b, u)) {
      const selected = selectedWeaponMode(b, u, { kind: 'attack', modeId: m.id });
      expect(selected).toEqual(m);
      expect(PATTERN_TEXT[selected.pattern]).toBeTruthy();
    }
    expect(selectedWeaponMode(b, u, { kind: 'move' })).toEqual(attackModes(b, u)[0]);
    const other = b.units.find(u => u.id !== 'jubal')!;
    expect(selectedWeaponMode(b, other, { kind: 'attack', modeId: 'sweep' })).toEqual(attackModes(b, other)[0]);
    expect(b).toEqual(before);
  });
});
