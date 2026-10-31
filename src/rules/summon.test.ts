import { describe, expect, it } from 'vitest';
import { SKILLS } from '../content/gear';
import { applyAction, RulesError } from './engine';
import { timelineEntries } from './queries';
import { unitById } from './state';
import { OPEN_7x7, testBattle } from './testkit';
import type { BattleState, Placement } from './types';

function activate(s: BattleState, id: string) {
  s.active = { ...s.active!, unitId: id };
}

const MOTHER: Placement = { template: 'rat_brood_mother', id: 'mother', at: { x: 3, y: 3 } };
const call = (s: BattleState) => applyAction(s, { type: 'skill', unitId: 'mother', skillId: 'call_the_brood', target: { x: 3, y: 3 } });

describe('Brood Mother summons', () => {
  it('spawns two rats beside her, nearest the enemy first, that join the timeline 50 AP later', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [MOTHER], config: { broodLargeRatChance: 0 } });
    activate(s, 'mother');
    const { state, events } = call(s);
    const spawns = events.filter((e) => e.t === 'spawn');
    expect(spawns).toHaveLength(2);
    const rats = state.units.filter((u) => u.templateId === 'brood_rat');
    expect(rats.map((r) => [r.side, r.name, r.glyph])).toEqual([['enemy', 'Brood Rat', 'r1'], ['enemy', 'Brood Rat', 'r2']]);
    expect(rats[0]!.pos).toEqual({ x: 2, y: 2 });
    expect([{ x: 2, y: 3 }, { x: 3, y: 2 }]).toContainEqual(rats[1]!.pos);
    for (const r of rats) {
      expect(r.nextTurnAt).toBe(s.clock + 50);
      expect(state.telemetry[r.id]).toBeDefined();
    }
    const ids = timelineEntries(state).map((e) => e.id);
    for (const r of rats) expect(ids).toContain(r.id);
    expect(unitById(state, 'mother').personalSkills.find((x) => x.id === 'call_the_brood')!.readyAt).toBe(s.clock + SKILLS.call_the_brood!.cooldown);
  });

  it('rolls each summon into a Large Rat at the configured chance', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [MOTHER], config: { broodLargeRatChance: 1 } });
    activate(s, 'mother');
    const large = call(s).state.units.filter((u) => u.templateId === 'large_rat');
    expect(large.map((r) => [r.side, r.name, r.glyph, r.maxHp, r.armor])).toEqual([['enemy', 'Large Rat', 'L1', 45, 25], ['enemy', 'Large Rat', 'L2', 45, 25]]);
    expect(large.every((r) => r.nextTurnAt === s.clock + 50)).toBe(true);
  });

  it('never lets the living brood, small and large, exceed the configured cap', () => {
    const rats: Placement[] = [{ template: 'brood_rat', id: 'ra', at: { x: 6, y: 6 } }, { template: 'large_rat', id: 'rb', at: { x: 6, y: 5 } }];
    const roomForOne = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [MOTHER, ...rats], config: { broodMaxRats: 3 } });
    activate(roomForOne, 'mother');
    expect(call(roomForOne).events.filter((e) => e.t === 'spawn')).toHaveLength(1);
    const full = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [MOTHER, ...rats], config: { broodMaxRats: 2 } });
    activate(full, 'mother');
    expect(() => call(full)).toThrow(RulesError);
    expect(() => call(full)).toThrow(/full strength/);
  });

  it('cannot summon when walled in', () => {
    const s = testBattle({ rows: ['.......', '.......', '..###..', '..#.#..', '..###..', '.......', '.......'], jubal: { x: 0, y: 0 }, enemies: [MOTHER] });
    activate(s, 'mother');
    expect(() => call(s)).toThrow(/no open tile/);
  });
});
