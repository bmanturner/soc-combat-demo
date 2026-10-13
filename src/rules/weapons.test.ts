import { describe, expect, it } from 'vitest';
import { WEAPONS, SKILLS } from '../content/gear';
import { applyAction, createBattle } from './engine';
import { DEFAULT_CONFIG } from './config';
import { OPEN_7x7, testBattle, testEncounter } from './testkit';
import { unitById } from './state';
import type { BattleState } from './types';

function fixture(weapon: string, secondary: string | null = null, strict = false): BattleState {
  const enc = testEncounter({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'nephilim', at: { x: 3, y: 1 }, initiative: 9999 }] });
  const s = createBattle(enc, { weaponIds: [weapon, secondary], armor: 'clothing' }, { ...DEFAULT_CONFIG, autoEndTurn: false, reactionsEnabled: false, critChance: 0, crossbowReload: strict ? 'strict' : 'flexible' }, 1).state;
  return s;
}
function next(s: BattleState): BattleState {
  return applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
}

describe('weapon execution goldens', () => {
  it('crossbow cadence is fire 50 / reload 50 / fire, with miss unloading', () => {
    let s = fixture('crossbow');
    const fire = { type: 'attack' as const, unitId: 'jubal', target: { x: 3, y: 1 }, modeId: 'fire' };
    s = applyAction(s, fire).state;
    expect(s.active!.actionSpent).toBe(50);
    expect(unitById(s, 'jubal').carried[0].loaded).toBe(false);
    s = next(s);
    expect(s.clock).toBe(50);
    expect(() => applyAction(s, fire)).toThrow();
    s = applyAction(s, { type: 'reload', unitId: 'jubal' }).state;
    expect(s.active!.actionSpent).toBe(50);
    expect(() => applyAction(s, fire)).toThrow();
    s = next(s);
    expect(s.clock).toBe(100);
    expect(applyAction(s, fire).state.active!.actionSpent).toBe(50);
  });
  it('strict debt blocks swaps and skills; flexible preserves unloaded reserve', () => {
    for (const strict of [true, false]) {
      let s = fixture('crossbow', 'shield', strict);
      s = next(applyAction(s, { type: 'skill', unitId: 'jubal', skillId: 'steady_bolt', target: { x: 3, y: 1 } }).state);
      const swap = { type: 'swapWeapon' as const, unitId: 'jubal', slot: 1 as const };
      if (strict) expect(() => applyAction(s, swap)).toThrow();
      else {
        s = applyAction(s, swap).state;
        expect(s.active!.actionSpent).toBe(50);
        expect(unitById(s, 'jubal').carried[0].loaded).toBe(false);
        expect(unitById(s, 'jubal').block).toBe(.3);
        expect(() => applyAction(s, { type: 'skill', unitId: 'jubal', skillId: 'shield_bash', target: { x: 3, y: 1 } })).toThrow();
      }
    }
  });
  it('javelin throw costs 125 without a bow surcharge; thrust accepts diagonals', () => {
    let s = fixture('javelin_shield');
    s = applyAction(s, { type: 'attack', unitId: 'jubal', target: { x: 3, y: 1 }, modeId: 'throw' }).state;
    expect(s.active!.actionSpent).toBe(125);
    s = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 4, y: 3 } }).state;
    expect(s.active!.actionSpent).toBe(125);
    expect(unitById(s, 'jubal').canEngage).toBe(true);
    expect(unitById(s, 'jubal').block).toBe(.25);
  });
  it('dual wield surviving lone primary receives two independent strikes', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'dual_wield', enemies: [{ template: 'wolf', at: { x: 3, y: 2 } }], config: { reactionsEnabled: false, critChance: 0 } });
    unitById(s, 'wolf').hp = 1000;
    const r = applyAction(s, { type: 'attack', unitId: 'jubal', target: { x: 3, y: 2 } });
    expect(r.events.filter(e => e.t === 'strike')).toHaveLength(2);
    expect(r.state.active!.actionSpent).toBe(100);
  });
  it('colossal sweep hits all eight once for 175 AP, independent of aim', () => {
    const ring = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'colossal', enemies: ring.map(([x,y], i) => ({ template: 'wolf', id: `w${i}`, at: { x: 3+x!, y: 3+y! } })), config: { reactionsEnabled: false, critChance: 0 } });
    const r = applyAction(s, { type: 'attack', unitId: 'jubal', target: { x: 3, y: 3 }, modeId: 'sweep' });
    expect(r.events.filter(e => e.t === 'strike')).toHaveLength(8);
    expect(r.events.find(e => e.t === 'attack')).toHaveProperty('apCost', 175);
  });
});

const ids = ['daggers', 'shield', 'polearm', 'two_handed', 'hunting_bow', 'crossbow', 'dual_wield', 'javelin_shield', 'colossal'];
describe('nine-family catalog golden', () => {
  it.each(ids)('%s owns two known skills and explicit modes/provenance', id => {
    const w = WEAPONS[id]!;
    expect(w).toBeDefined();
    expect(w.skills).toHaveLength(2);
    for (const s of w.skills) expect(SKILLS[s]).toBeDefined();
    expect(w).toHaveProperty('modes');
    expect(w).toHaveProperty('provenance.concept', 'source');
    expect(w).toHaveProperty('fieldProvenance.attack.apCost.status', 'source');
    expect(w).toHaveProperty('fieldProvenance.attack.hit.status', 'demo');
    expect(SKILLS[w.skills[0]!]).toHaveProperty('fieldProvenance.cooldown.status', 'demo');
  });
});
