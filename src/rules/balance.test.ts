import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../content/gear';
import { DEFAULT_CONFIG } from './config';
import { scaledMode } from './equipment';

describe('demo single-target sustained budgets', () => {
  const bands: Record<string, [number, number]> = { daggers: [60,70], shield: [55,65], polearm: [55,65], two_handed: [55,65], hunting_bow: [60,70], crossbow: [60,70], dual_wield: [60,70], javelin_shield: [55,65], colossal: [45,55] };
  for (const [id, band] of Object.entries(bands)) it(`${id}: unarmored, no reactions, reload included`, () => {
    const w = WEAPONS[id]!;
    for (const mode of w.modes) {
      const m = scaledMode(DEFAULT_CONFIG, { side: 'player', level: 1, templateId: 'jubal' }, w, mode);
      const normal = Math.round(m.damage), crit = Math.round(m.damage * DEFAULT_CONFIG.critMult);
      const damage = m.hit * ((1-DEFAULT_CONFIG.critChance)*normal + DEFAULT_CONFIG.critChance*crit);
      const rate = damage * (m.pattern === 'dualArc' ? 2 : 1) * 100 / (m.apCost + (w.reloadAp ?? 0));
      const [min,max] = m.id === 'throw' ? [40,50] : band;
      expect(rate).toBeGreaterThanOrEqual(min);
      expect(rate).toBeLessThanOrEqual(max);
    }
  });
});
