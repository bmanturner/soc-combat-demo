import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../content/encounters';
import { DEFAULT_CONFIG } from './config';
import { key } from './geometry';
import { runBattle } from './sim';
import { tilesOf } from './state';

const WEAPONS = ['daggers', 'shield', 'polearm', 'two_handed'];

describe('Bot-played battles', () => {
  for (const enc of ENCOUNTERS) {
    it(`${enc.id}: every starter weapon finishes the fight`, () => {
      for (const weaponId of WEAPONS) {
        const r = runBattle(enc.id, { weaponId, armor: enc.defaultArmor }, DEFAULT_CONFIG, 7);
        expect(r.outcome, `${enc.id}/${weaponId}`).not.toBe('stalled');
      }
    });
  }

  it('is deterministic: same seed and setup → identical log', () => {
    const a = runBattle('cultists', { weaponId: 'polearm', armor: 'medium' }, DEFAULT_CONFIG, 99);
    const b = runBattle('cultists', { weaponId: 'polearm', armor: 'medium' }, DEFAULT_CONFIG, 99);
    expect(JSON.stringify(a.state.log)).toBe(JSON.stringify(b.state.log));
  });

  it('invariants hold for arbitrary seeds and loadouts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.constantFrom(...ENCOUNTERS.map((e) => e.id)),
        fc.constantFrom(...WEAPONS),
        fc.constantFrom('light', 'medium', 'heavy'),
        (seed, encId, weaponId, armor) => {
          const enc = ENCOUNTERS.find((e) => e.id === encId)!;
          const r = runBattle(encId, { weaponId, armor: enc.allowedArmor.includes(armor as never) ? (armor as never) : enc.defaultArmor }, DEFAULT_CONFIG, seed);
          expect(r.outcome).not.toBe('stalled');
          let last = -Infinity;
          for (const e of r.state.log) {
            if (e.t === 'turnStart') {
              expect(e.clock).toBeGreaterThanOrEqual(last);
              last = e.clock;
            }
          }
          const seen = new Set<string>();
          for (const u of r.state.units) {
            expect(u.hp).toBeGreaterThanOrEqual(0);
            expect(u.hp).toBeLessThanOrEqual(u.maxHp);
            if (u.ko) continue;
            for (const t of tilesOf(u)) {
              expect(seen.has(key(t)), `two units on ${key(t)}`).toBe(false);
              seen.add(key(t));
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
