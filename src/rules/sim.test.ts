import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import * as ai from './ai';
import * as engine from './engine';
import { OPEN_7x7, testBattle } from './testkit';
import { ENCOUNTERS } from '../content/encounters';
import { DEFAULT_CONFIG } from './config';
import { key } from './geometry';
import { runBattle, simulateBattle } from './sim';
import { tilesOf } from './state';

const WEAPONS = ['daggers', 'shield', 'polearm', 'two_handed'];

describe('Bot-played battles', () => {
  it('A-05 records illegal action, seed, policy and clock before falling back', () => {
    const spy = vi.spyOn(ai, 'botAction').mockReturnValueOnce({ type: 'attack', unitId: 'jubal', target: { x: -1, y: -1 } });
    try {
      const r = runBattle('granary', { weaponId: 'daggers', armor: 'clothing' }, DEFAULT_CONFIG, 7);
      expect(r.illegalFallbacks).toBe(1);
      expect(r.fallbacks[0]).toMatchObject({ seed: 7, encounterId: 'granary', policy: 'expert', clock: 0, action: { type: 'attack' } });
      expect(r.fallbacks[0]!.message.length).toBeGreaterThan(0);
    } finally { spy.mockRestore(); }
  });

  it('watchdog marks a non-damaging disconnected fight as stalled before action cap', () => {
    const s = testBattle({ rows: ['...#...', '...#...', '...#...'], jubal: { x: 1, y: 1 }, enemies: [{ template: 'wolf', id: 'wolf', at: { x: 5, y: 1 } }] });
    const r = simulateBattle(s);
    expect(r.outcome).toBe('stalled');
    expect(r.stallReason).toBe('no-combat-progress');
    expect(r.actions).toBeLessThan(4000);
    expect(r.illegalFallbacks).toBe(0);
  });

  it('watchdog detects a frozen timeline', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 1 }, enemies: [{ template: 'wolf', id: 'wolf', at: { x: 5, y: 1 } }] });
    // Fault injection remains valid when the rules track clamps empty-turn delay above zero.
    const spy = vi.spyOn(engine, 'applyAction').mockReturnValue({ state: s, events: [] });
    try {
      const r = simulateBattle(s);
      expect(r.outcome).toBe('stalled');
      expect(r.stallReason).toBe('clock-not-advancing');
      expect(r.actions).toBeLessThan(4000);
    } finally { spy.mockRestore(); }
  });

  for (const enc of ENCOUNTERS) for (const policy of ['expert', 'novice'] as const) {
    it(`${enc.id}/${policy}: every starter weapon finishes the fight`, () => {
      for (const weaponId of WEAPONS) {
        const r = runBattle(enc.id, { weaponId, armor: enc.defaultArmor }, DEFAULT_CONFIG, 7, 4000, policy);
        expect(r.illegalFallbacks, JSON.stringify(r.fallbacks)).toBe(0);
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
          expect(r.illegalFallbacks, JSON.stringify(r.fallbacks)).toBe(0);
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
  }, 30_000); // Full seeded battles, not a small unit test; keep the sampled runs intact.
});
