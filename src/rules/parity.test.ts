// Regression and property coverage for shared engine/query contracts.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyAction, castEffect, RulesError } from './engine';
import { previewAttack, previewSkill, projectedNextTurn, reachable, attackOptions, timelineEntries } from './queries';
import { botAction, enemyAction } from './ai';
import { unitById } from './state';
import { DEFAULT_CONFIG, sanitizeOverrides } from './config';
import { OPEN_7x7, testBattle } from './testkit';
import type { BattleState } from './types';

function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
}
const duel = (seed = 1) => testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 3 }, enemies: [{ template: 'wolf', at: { x: 3, y: 3 } }], seed, config: { critChance: 0, reactionsEnabled: false } });
function bossTurn(config = {}) {
  let s = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 5 }, enemies: [{ template: 'nephilim', at: { x: 2, y: 0 }, initiative: 0 }], config: { tiePlayerFirst: false, reactionsEnabled: false, critChance: 0, ...config }, boss: { eye: { x: 3, y: 1 }, sweepRowStart: 2, sweepCols: [0, 6] } });
  while (s.active?.unitId !== 'nephilim') s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
  return s;
}

describe('engine and preview parity', () => {
  it('R-01: minimum delay zero must not starve every other unit/effect', () => {
    let s = duel();
    s.config.noActionTurnAp = 0;
    for (let n = 0; n < 20; n++) s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
    expect(s.clock).toBeGreaterThan(0);
  });
  it('R-02: being held while crossing allies must not leave overlapping units', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 1 }, allies: [{ template: 'jabal', at: { x: 1, y: 1 } }, { template: 'jabal', id: 'ally2', at: { x: 2, y: 1 } }], enemies: [{ template: 'wolf', at: { x: 0, y: 0 } }], config: { engageBase: 1, engageMax: 1, engagePerPoint: 0, aooChance: 0 } });
    const out = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 3, y: 1 } });
    expect(out.events.some(e => e.t === 'disengage' && e.held)).toBe(true);
    const positions = out.state.units.map(u => `${u.pos.x},${u.pos.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
  it('R-03: rock throw preview damage must match the configured landed damage', () => {
    const s = bossTurn();
    const p = previewSkill(s, unitById(s, 'nephilim'), 'rock_throw', unitById(s, 'jubal').pos)!;
    const result = applyAction(s, { type: 'skill', unitId: 'nephilim', skillId: 'rock_throw', target: unitById(s, 'jubal').pos });
    const hit = result.events.find(e => e.t === 'strike');
    expect(hit?.t === 'strike' && hit.damage).toBe(p.targets[0]!.damageIfLands);
  });
  it('R-03: raw-damage spell preview must apply the side damage multiplier', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 3 }, weapon: 'cultist_staff', enemies: [{ template: 'wolf', at: { x: 4, y: 3 } }], config: { playerDamageMult: 3, critChance: 0, reactionsEnabled: false } });
    const p = previewSkill(s, unitById(s, 'jubal'), 'daze_bolt', { x: 4, y: 3 })!;
    const result = applyAction(s, { type: 'skill', unitId: 'jubal', skillId: 'daze_bolt', target: { x: 4, y: 3 } });
    const hit = result.events.find(e => e.t === 'strike');
    expect(hit?.t === 'strike' && hit.damage).toBe(p.targets[0]!.damageIfLands);
  });
  it('R-04: boss skill AP and next-turn preview must respect bossTurnAp', () => {
    const s = bossTurn({ bossTurnAp: 200 });
    const p = previewSkill(s, unitById(s, 'nephilim'), 'rock_throw', unitById(s, 'jubal').pos)!;
    const cast = applyAction(s, { type: 'skill', unitId: 'nephilim', skillId: 'rock_throw', target: unitById(s, 'jubal').pos });
    expect(cast.events.find(e => e.t === 'attack')?.apCost).toBe(p.apCost);
  });
  it('R-04: waiting boss projected next turn must use its minimum rhythm', () => {
    const s = bossTurn();
    const delay = projectedNextTurn(s, 0);
    const end = applyAction(s, { type: 'endTurn', unitId: 'nephilim' });
    expect(unitById(end.state, 'nephilim').nextTurnAt - s.clock).toBe(delay);
  });
  it('R-05: preview from a proposed tile must recompute flanking there', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 2 }, allies: [{ template: 'jabal', at: { x: 4, y: 3 } }], enemies: [{ template: 'wolf', at: { x: 3, y: 3 } }], config: { critChance: 0, reactionsEnabled: false } });
    const proposed = previewAttack(s, unitById(s, 'jubal'), { x: 3, y: 3 }, { x: 2, y: 3 })!;
    const moved = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 2, y: 3 } }).state;
    const actual = previewAttack(moved, unitById(moved, 'jubal'), { x: 3, y: 3 })!;
    expect(proposed.targets).toEqual(actual.targets);
  });
  it('R-06: immune source standing in its own effect must not count as an escape', () => {
    let s = duel();
    s.config.delayedHitsAllies = false;
    const source = unitById(s, 'jubal');
    castEffect(s, source, { name: 'test', tiles: [source.pos], delay: 1, damage: 10, damageType: 'magic', pctPen: 0 }, []);
    s = applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
    while (s.clock < 1) s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
    expect(s.telemetry.jubal!.escapes).toBe(0);
  });
  it('R-08: bow attack preview from a proposed move must include the movement surcharge', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, weapon: 'hunting_bow', enemies: [{ template: 'wolf', at: { x: 4, y: 0 } }], config: { critChance: 0, reactionsEnabled: false } });
    const p = previewAttack(s, unitById(s, 'jubal'), { x: 4, y: 0 }, { x: 0, y: 1 })!;
    const moved = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 0, y: 1 } }).state;
    const attack = applyAction(moved, { type: 'attack', unitId: 'jubal', target: { x: 4, y: 0 } });
    expect(attack.events.find(e => e.t === 'attack')?.apCost).toBe(p.apCost);
  });
  it('R-09: sweep preview must show its configured impact delay', () => {
    const s = bossTurn({ sweepDelay: 150 });
    const p = previewSkill(s, unitById(s, 'nephilim'), 'nephilim_sweep', { x: 2, y: 3 })!;
    const cast = applyAction(s, { type: 'skill', unitId: 'nephilim', skillId: 'nephilim_sweep', target: { x: 2, y: 3 } }).state;
    expect(p.note).toBe(`Erupts in ${cast.effects[0]!.resolveAt - cast.clock} AP · Reactions at impact: none (current-board estimate)`);
  });
  it('R-07: timeline display ties must match the scheduler settings', () => {
    const s = duel();
    s.config.tiePlayerFirst = false;
    unitById(s, 'wolf').nextTurnAt = 50;
    s.active!.actionSpent = 50;
    const ended = applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
    expect(timelineEntries(ended)[0]!.id).toBe(ended.active!.unitId);
  });
});

describe('invariant/property controls', () => {
  it('seeded applyAction is deterministic, immutable, and JSON roundtrip equivalent', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const s = duel(seed);
      const before = JSON.stringify(s);
      const restored = JSON.parse(before) as BattleState;
      freezeDeep(s);
      const action = { type: 'attack' as const, unitId: 'jubal', target: { x: 3, y: 3 } };
      expect(applyAction(s, action)).toEqual(applyAction(restored, action));
      expect(JSON.stringify(s)).toBe(before);
    }), { numRuns: 100 });
  });
  it('queries and AI leave deeply frozen state/RNG untouched', () => {
    const s = duel(); const before = JSON.stringify(s); freezeDeep(s);
    const u = unitById(s, 'jubal');
    reachable(s, u.id); attackOptions(s, u); previewSkill(s, u, 'throwing_knife', { x: 3, y: 3 });
    projectedNextTurn(s, 50); timelineEntries(s); botAction(s); enemyAction(s);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('reachable costs equal actual unobstructed moves for random seeds and tile costs', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 10, max: 40 }), (seed, halfCost) => {
      const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 } }], seed, config: { moveApLight: halfCost / 2 } });
      for (const r of reachable(s, 'jubal').values()) {
        if (r.path.length < 2) continue;
        const moved = applyAction(s, { type: 'move', unitId: 'jubal', to: r.path.at(-1)! }).state;
        expect(moved.active!.moveSpent).toBe(r.cost);
      }
    }), { numRuns: 30 });
  });
  it('landChance agrees with empirical hit frequency over 4000 fixed seeds', () => {
    let landed = 0;
    const s = duel(); s.config.reactionsEnabled = true;
    const predicted = previewAttack(s, unitById(s, 'jubal'), { x: 3, y: 3 })!.targets[0]!.landChance;
    for (let seed = 0; seed < 4000; seed++) {
      const trial = duel(seed); trial.config.reactionsEnabled = true;
      const result = applyAction(trial, { type: 'attack', unitId: 'jubal', target: { x: 3, y: 3 } });
      if (result.events.some(e => e.t === 'strike' && e.hit && !e.avoided)) landed++;
    }
    expect(Math.abs(landed / 4000 - predicted)).toBeLessThan(0.035);
  });
  it('effects use resolution positions and hit a partially covered boss only once', () => {
    let s = bossTurn();
    const boss = unitById(s, 'nephilim');
    castEffect(s, unitById(s, 'jubal'), { name: 'partial footprint', tiles: [{ x: boss.pos.x + 1, y: boss.pos.y }], delay: 1, damage: 10, damageType: 'magic', pctPen: 0 }, []);
    const events = [];
    for (let i = 0; i < 10 && s.effects.length; i++) {
      const result = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId });
      s = result.state; events.push(...result.events);
    }
    const resolve = events.find(e => e.t === 'effectResolve');
    expect(resolve?.t === 'effectResolve' && resolve.hits.map(h => h.unitId)).toEqual(['nephilim']);
  });
  it('sanitizer drops unknown, prototype keys, invalid types and nonfinite values; documented clamping', () => {
    expect(sanitizeOverrides(JSON.parse('{"__proto__":{"polluted":true},"constructor":{},"noActionTurnAp":"0","critChance":null,"unknown":5}'))).toEqual({});
    expect(sanitizeOverrides({ noActionTurnAp: Infinity, critChance: NaN })).toEqual({});
    expect(sanitizeOverrides({ noActionTurnAp: -5 })).toEqual({ noActionTurnAp: 5 });
    expect(DEFAULT_CONFIG.noActionTurnAp).toBe(25);
    expect(() => applyAction(duel(), { type: 'move', unitId: 'jubal', to: { x: -1, y: -1 } })).toThrow(RulesError);
  });
});
