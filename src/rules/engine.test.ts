import { describe, expect, it } from 'vitest';
import { applyAction } from './engine';
import { reachable } from './queries';
import { isFlanked, unitById } from './state';
import { OPEN_7x7, play, testBattle } from './testkit';
import type { BattleState } from './types';

const NEPH_ROWS = [
  '####...####',
  '####...####',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '#.........#',
  '###########',
];
const BOSS = { sweepRowStart: 2, sweepCols: [1, 9] as [number, number], eye: { x: 5, y: 1 } };

function bossFight(o: { at: { x: number; y: number }; weapon: string; armor: 'light' | 'medium' | 'heavy'; bossInit?: number; config?: Record<string, unknown> }): BattleState {
  return testBattle({
    rows: NEPH_ROWS,
    jubal: o.at,
    weapon: o.weapon,
    armor: o.armor,
    level: 5,
    enemies: [{ template: 'nephilim', at: { x: 5, y: 1 }, id: 'boss', initiative: o.bossInit ?? 30 }],
    boss: BOSS,
    // Freeze the proposal's demo sweep numbers; this golden tests AP/tie semantics, not balance defaults.
    config: { critChance: 0, sweepDelay: 75, sweepDamage: 500, ...o.config },
  });
}

/** Jubal acts (path + attack), boss sweeps on its turn, then Jubal tries to run to row 5. */
function sweepScenario(o: Parameters<typeof bossFight>[0] & { moveTo: { x: number; y: number }; attack: { x: number; y: number } }) {
  let s = bossFight(o);
  expect(s.active?.unitId).toBe('jubal');
  const acts = [];
  if (o.moveTo.x !== o.at.x || o.moveTo.y !== o.at.y) acts.push({ type: 'move' as const, unitId: 'jubal', to: o.moveTo });
  acts.push({ type: 'attack' as const, unitId: 'jubal', target: o.attack });
  s = play(s, acts).state;
  if (s.active?.unitId === 'jubal') s = applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
  const jubalNext = unitById(s, 'jubal').nextTurnAt;
  // Boss turn: telegraph the sweep.
  expect(s.active?.unitId).toBe('boss');
  s = applyAction(s, { type: 'skill', unitId: 'boss', skillId: 'nephilim_sweep', target: { x: 5, y: 3 } }).state;
  if (s.active?.unitId === 'boss') s = applyAction(s, { type: 'endTurn', unitId: 'boss' }).state;
  const sweep = s.effects[0];
  // If Jubal gets a turn before impact, run out of the zone.
  if (s.active?.unitId === 'jubal') {
    const j = unitById(s, 'jubal');
    s = play(s, [{ type: 'move', unitId: 'jubal', to: { x: j.pos.x, y: 5 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
  }
  return { s, jubalNext, impact: sweep?.resolveAt, jubal: unitById(s, 'jubal') };
}

describe('Boss telegraph escapes (proposal §9 table: boss acts in 30, sweep lands at 105)', () => {
  it('light + move 3 + dagger → next turn 80, margin +25, escapes', () => {
    const r = sweepScenario({ at: { x: 5, y: 5 }, weapon: 'daggers', armor: 'light', moveTo: { x: 5, y: 2 }, attack: { x: 5, y: 1 } });
    expect(r.jubalNext).toBe(80);
    expect(r.impact).toBe(105);
    expect(r.jubal.ko).toBe(false);
    expect(r.s.telemetry.jubal!.escapes).toBe(1);
  });
  it('light + move 2 + two-handed → next turn 145, margin −40, caught', () => {
    const r = sweepScenario({ at: { x: 5, y: 4 }, weapon: 'two_handed', armor: 'light', moveTo: { x: 5, y: 2 }, attack: { x: 5, y: 1 } });
    expect(r.jubalNext).toBe(145);
    expect(r.jubal.ko).toBe(true);
  });
  it('heavy + move 3 + shield → next turn 120, margin −15, caught', () => {
    const r = sweepScenario({ at: { x: 5, y: 5 }, weapon: 'shield', armor: 'heavy', moveTo: { x: 5, y: 2 }, attack: { x: 5, y: 1 } });
    expect(r.jubalNext).toBe(120);
    expect(r.jubal.ko).toBe(true);
  });
  it('heavy + move 1 + shield → next turn 90, margin +15, escapes (3 tiles is exactly enough)', () => {
    const r = sweepScenario({ at: { x: 5, y: 3 }, weapon: 'shield', armor: 'heavy', moveTo: { x: 5, y: 2 }, attack: { x: 5, y: 1 } });
    expect(r.jubalNext).toBe(90);
    expect(r.jubal.ko).toBe(false);
  });
  it('medium + polearm from 2 tiles, no move → next turn 100, margin +5, escapes', () => {
    const r = sweepScenario({ at: { x: 5, y: 3 }, weapon: 'polearm', armor: 'medium', moveTo: { x: 5, y: 3 }, attack: { x: 5, y: 1 } });
    expect(r.jubalNext).toBe(100);
    expect(r.jubal.ko).toBe(false);
  });
  it('margin exactly 0: units-first tie rule lets you escape; effects-first does not', () => {
    const base = { at: { x: 5, y: 3 }, weapon: 'polearm', armor: 'medium' as const, moveTo: { x: 5, y: 3 }, attack: { x: 5, y: 1 }, bossInit: 25 };
    expect(sweepScenario(base).jubal.ko).toBe(false);
    expect(sweepScenario({ ...base, config: { tieUnitBeforeEffect: false } }).jubal.ko).toBe(true);
  });
});

describe('Timeline', () => {
  it('next turn = AP spent; waiting costs the minimum delay', () => {
    let s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'small_rat', at: { x: 6, y: 6 }, initiative: 500 }] });
    s = play(s, [{ type: 'endTurn', unitId: 'jubal' }]).state;
    expect(unitById(s, 'jubal').nextTurnAt).toBe(25);
    expect(s.clock).toBe(25);
    s = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 0 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
    expect(unitById(s, 'jubal').nextTurnAt).toBe(55);
  });
  it('the unit with the lowest AP acts next; ties go to the party', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'small_rat', at: { x: 6, y: 6 }, initiative: 0 }] });
    expect(s.active?.unitId).toBe('jubal');
  });
});

describe('Movement', () => {
  it('orthogonal movement: light reaches 5 tiles, heavy 3', () => {
    const light = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, armor: 'light', enemies: [{ template: 'small_rat', at: { x: 0, y: 0 }, initiative: 999 }] });
    // Every tile within Manhattan 5: all 49 minus the four corners (distance 6, one holds the rat) minus the start.
    expect(reachable(light, 'jubal').size - 1).toBe(49 - 4 - 1);
    const heavy = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, armor: 'heavy', enemies: [{ template: 'small_rat', at: { x: 0, y: 0 }, initiative: 999 }] });
    expect(reachable(heavy, 'jubal').size - 1).toBe(24);
  });
  it('units walk through allies but never stop on them', () => {
    let s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 6 }, allies: [{ template: 'jabal', at: { x: 3, y: 5 }, id: 'jabal', initiative: 999 }], enemies: [{ template: 'small_rat', at: { x: 0, y: 0 }, initiative: 999 }] });
    s = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 2 } }]).state;
    expect(unitById(s, 'jubal').pos).toEqual({ x: 3, y: 2 });
    expect(reachable(s, 'jubal').has('3,5')).toBe(false);
  });
  it('move, act, move: movement budget is shared across the turn', () => {
    let s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 3 }, armor: 'light', enemies: [{ template: 'small_rat', at: { x: 3, y: 3 }, initiative: 999 }] });
    s = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 2, y: 3 } }, { type: 'attack', unitId: 'jubal', target: { x: 3, y: 3 } }]).state;
    expect(reachable(s, 'jubal').size - 1).toBeGreaterThan(0);
    expect(() => applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 2, y: 0 } })).not.toThrow();
    expect(() => applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 6, y: 6 } })).toThrow();
  });
});

describe('Bow rule', () => {
  const setup = () => testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 3 }, weapon: 'hunting_bow', enemies: [{ template: 'wolf', at: { x: 5, y: 3 }, initiative: 999 }], config: { reactionsEnabled: false, critChance: 0 } });
  it('75 AP standing still', () => {
    const s = play(setup(), [{ type: 'attack', unitId: 'jubal', target: { x: 5, y: 3 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
    expect(unitById(s, 'jubal').nextTurnAt).toBe(75);
  });
  it('125 AP if you moved first', () => {
    const s = play(setup(), [{ type: 'move', unitId: 'jubal', to: { x: 0, y: 2 } }, { type: 'attack', unitId: 'jubal', target: { x: 5, y: 3 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
    expect(unitById(s, 'jubal').nextTurnAt).toBe(10 + 125);
  });
  it('moving after a stationary shot pays the surcharge too', () => {
    const s = play(setup(), [{ type: 'attack', unitId: 'jubal', target: { x: 5, y: 3 } }, { type: 'move', unitId: 'jubal', to: { x: 0, y: 2 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
    expect(unitById(s, 'jubal').nextTurnAt).toBe(75 + 50 + 10);
  });
});

describe('Engagement and disengagement', () => {
  const pinned = (config: Record<string, unknown>, weapon = 'daggers') =>
    testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon, enemies: [{ template: 'cultist_fighter', at: { x: 3, y: 2 }, id: 'z', initiative: 999 }], config: { aooChance: 0, ...config } });

  it('a held unit moves exactly one square and its movement locks', () => {
    const r = play(pinned({ engageMin: 1, engageMax: 1 }), [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 6 } }]);
    expect(unitById(r.state, 'jubal').pos).toEqual({ x: 3, y: 4 });
    expect(r.state.active?.movementLocked).toBe(true);
    expect(r.events.some((e) => e.t === 'disengage' && e.held)).toBe(true);
  });
  it('a clean disengage keeps the whole path', () => {
    const r = play(pinned({ engageMin: 0, engageMax: 0 }), [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 6 } }]);
    expect(unitById(r.state, 'jubal').pos).toEqual({ x: 3, y: 6 });
  });
  it('moving while staying in contact needs no check', () => {
    const r = play(pinned({ engageMin: 1, engageMax: 1 }), [{ type: 'move', unitId: 'jubal', to: { x: 2, y: 3 } }]);
    expect(r.events.some((e) => e.t === 'disengage')).toBe(false);
  });
  it('ranged wielders cannot engage: walk away from an archer freely', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'hired_archer', at: { x: 3, y: 2 }, initiative: 999 }], config: { engageMin: 1, engageMax: 1 } });
    // hired_archer is a player template; flip it to an enemy for this check.
    s.units[1]!.side = 'enemy';
    const r = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 6 } }]);
    expect(unitById(r.state, 'jubal').pos).toEqual({ x: 3, y: 6 });
  });
});

describe('Flanked', () => {
  it('melee enemies on opposite cardinal sides flank; a diagonal pair does not by default', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 3, y: 2 }, initiative: 999 }, { template: 'wolf', at: { x: 3, y: 4 }, id: 'w2', initiative: 999 }] });
    expect(isFlanked(s, unitById(s, 'jubal'))).toBe(true);
    const d = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 2, y: 2 }, initiative: 999 }, { template: 'wolf', at: { x: 4, y: 4 }, id: 'w2', initiative: 999 }] });
    expect(isFlanked(d, unitById(d, 'jubal'))).toBe(false);
    expect(isFlanked({ ...d, config: { ...d.config, flankDiagonals: true } }, unitById(d, 'jubal'))).toBe(true);
  });
});

describe('Friendly fire and delayed effects', () => {
  it('weapon patterns skip allies by default', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'two_handed', allies: [{ template: 'jabal', at: { x: 2, y: 3 }, id: 'jabal', initiative: 999 }], enemies: [{ template: 'small_rat', at: { x: 3, y: 2 }, initiative: 999 }] });
    const r = play(s, [{ type: 'attack', unitId: 'jubal', target: { x: 3, y: 2 } }]);
    expect(r.events.filter((e) => e.t === 'strike').map((e) => (e as { targetId: string }).targetId)).toEqual(['small_rat']);
  });
  it("a cultist sigil burns cultists standing in it", () => {
    let s = testBattle({
      rows: OPEN_7x7,
      jubal: { x: 3, y: 3 },
      enemies: [
        { template: 'cultist_mage', at: { x: 0, y: 0 }, id: 'seer', initiative: 0 },
        { template: 'cultist_fighter', at: { x: 3, y: 2 }, id: 'z', initiative: 999 },
      ],
      config: { engageMin: 0, engageMax: 0 },
    });
    // Party acts first on ties; let Jubal wait so the seer can cast.
    s = play(s, [{ type: 'endTurn', unitId: 'jubal' }]).state;
    expect(s.active?.unitId).toBe('seer');
    s = play(s, [{ type: 'skill', unitId: 'seer', skillId: 'hellfire_sigil', target: { x: 3, y: 3 } }, { type: 'endTurn', unitId: 'seer' }]).state;
    // Jubal walks out; the zealot stays.
    s = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 3, y: 6 } }, { type: 'endTurn', unitId: 'jubal' }]).state;
    while (s.effects.length && s.active) s = play(s, [{ type: 'endTurn', unitId: s.active.unitId }]).state;
    expect(unitById(s, 'z').hp).toBeLessThan(unitById(s, 'z').maxHp);
    expect(unitById(s, 'jubal').hp).toBe(unitById(s, 'jubal').maxHp);
  });
});
