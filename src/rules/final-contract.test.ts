import { expect, it } from 'vitest';
import { ARMOR, SKILLS } from '../content/gear';
import { UNITS } from '../content/units';
import { applyAction, castEffect } from './engine';
import { tileDanger } from './ai';
import { escapeOutlook, previewSkill, reachable } from './queries';
import { engagersLeft, unitById } from './state';
import { hypotheticalBoard, resolveSkill } from './resolvers';
import { OPEN_7x7, testBattle } from './testkit';
import type { GameEvent, ReactionResult } from './types';
import { describeEvent, formatAp } from './describe';

it('F-01: every path-node risk matches engine engagement, including ally transit and gaining/losing flanks', () => {
  const b = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, allies: [{ template: 'jabal', at: { x: 3, y: 3 } }, { template: 'hired_archer', at: { x: 1, y: 2 } }], enemies: [{ template: 'wolf', at: { x: 2, y: 3 } }], config: { engageBase: 1, engagePerPoint: 0, engageMax: 1, aooChance: 0 } });
  const u = unitById(b, 'jubal');
  let transit = false, risks = 0;
  for (const from of [u.pos, { x: 1, y: 1 }]) {
    for (const r of reachable(b, u.id, { from }).values()) {
      const rolled: string[] = [];
      for (let i = 1; i < r.path.length; i++) {
        const board = hypotheticalBoard(b, u, r.path[i - 1]!);
        const leaving = engagersLeft(board, unitById(board, u.id), r.path[i - 1]!, r.path[i]!, rolled);
        const advertised = r.risks.find(risk => risk.index === i)?.engagerIds ?? [];
        expect(advertised).toEqual(leaving.map(e => e.id));
        rolled.push(...advertised); risks += advertised.length;
        transit ||= r.path[i - 1]!.x === 1 && r.path[i - 1]!.y === 2;
      }
    }
  }
  expect(transit).toBe(true); expect(risks).toBeGreaterThan(0);
});

it('F-01: escape outlook and AI receive engagement regained after breaking a flank', () => {
  const b = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, allies: [{ template: 'jabal', at: { x: 3, y: 3 } }], enemies: [{ template: 'wolf', at: { x: 2, y: 3 } }], config: { engageBase: 1, engagePerPoint: 0, engageMax: 1, aooChance: 0, movementBudget: 30 } });
  const tiles = OPEN_7x7.flatMap((row, y) => [...row].map((_, x) => ({ x, y }))).filter(p => p.x !== 1 || p.y !== 0);
  const eff = castEffect(b, unitById(b, 'wolf'), { name: 'Fixture', tiles, delay: 100, damage: 100, damageType: 'magic', pctPen: 0 }, []);
  const u = unitById(b, 'jubal');
  expect(escapeOutlook(b, u, eff)).toMatchObject({ reachableSafe: true, disengageRisk: 1 });
  expect(tileDanger(b, u, u.pos, 25, false)).toBeGreaterThan(0);
});

it.each<ReactionResult['kind'] | 'none'>(['block', 'dodge', 'parry', 'none'])('F-02: delayed %s policy survives cast, preview and impact with reaction AP/status/displacement', kind => {
  const original = SKILLS.hellfire_sigil!;
  SKILLS.hellfire_sigil = { ...original, delay: 1, applies: 'dazed', allowedReactions: kind === 'none' ? [] : [kind] };
  try {
    let b = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, enemies: [{ template: 'wolf', at: { x: 4, y: 3 }, initiative: 999 }], config: { autoEndTurn: false, critChance: 1 } });
    const u = unitById(b, 'jubal'), t = unitById(b, 'wolf');
    u.personalSkills.push({ id: 'hellfire_sigil', readyAt: 0 });
    t.hp = t.maxHp = 999; t.dodge = t.block = t.parry = 1;
    const p = previewSkill(b, u, 'hellfire_sigil', t.pos)!;
    expect(p.targets[0]!.avoidChance).toBe(kind === 'none' ? 0 : 1);
    const cast = applyAction(b, { type: 'skill', unitId: u.id, skillId: 'hellfire_sigil', target: t.pos });
    b = cast.state;
    expect(b.effects[0]!.allowedReactions).toEqual(kind === 'none' ? [] : [kind]);
    // Changing the authoring record later must not change an already-cast effect.
    SKILLS.hellfire_sigil = { ...original, allowedReactions: [] };
    const result = applyAction(b, { type: 'endTurn', unitId: u.id });
    const impact = result.events.find(e => e.t === 'effectResolve')!;
    expect(impact.t).toBe('effectResolve');
    if (impact.t !== 'effectResolve') throw new Error('missing impact');
    const hit = impact.hits[0]!;
    const after = unitById(result.state, t.id);
    expect(hit.avoided).toBe(kind === 'none' ? null : kind);
    expect(hit.damage).toBe(kind === 'none' ? p.targets[0]!.damageIfLands : 0);
    expect(after.dazed).toBe(kind === 'none');
    if (kind !== 'none') expect(after.nextTurnAt).toBe(t.nextTurnAt + b.config[`${kind}Ap`]);
    expect(after.pos).toEqual(kind === 'dodge' ? { x: 5, y: 3 } : t.pos);
    if (kind === 'dodge') expect(result.events).toContainEqual({ t: 'displace', unitId: t.id, from: t.pos, to: { x: 5, y: 3 }, reason: 'dodge' });
  } finally { SKILLS.hellfire_sigil = original; }
});

it.each(['disabled', 'dazed', 'blocked-dodge', 'immobile'] as const)('F-02: delayed reactions respect %s at impact', condition => {
  let b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 1, y: 3 }, initiative: 999 }], config: { reactionsEnabled: condition !== 'disabled' } });
  const u = unitById(b, 'jubal');
  u.dodge = 1; u.dazed = condition === 'dazed'; u.immobile = condition === 'immobile';
  if (condition === 'blocked-dodge') b.map.tiles[3 * b.map.width + 4] = 'wall';
  // Keep the victim off-turn: ending its own turn would correctly clear daze before impact.
  b.active!.unitId = 'wolf'; u.nextTurnAt = 999;
  castEffect(b, unitById(b, 'wolf'), { name: 'Fixture', tiles: [u.pos], delay: 1, damage: 50, damageType: 'magic', pctPen: 0, allowedReactions: ['dodge'] }, []);
  const result = applyAction(b, { type: 'endTurn', unitId: 'wolf' });
  b = result.state;
  const impact = result.events.find(e => e.t === 'effectResolve');
  if (impact?.t !== 'effectResolve') throw new Error('missing impact');
  expect(impact.hits[0]!.avoided).toBe(condition === 'blocked-dodge' ? 'dodge' : null);
  expect(unitById(b, u.id).pos).toEqual(u.pos);
  if (condition === 'blocked-dodge') expect(unitById(b, u.id).hp).toBe(u.hp);
  else expect(unitById(b, u.id).hp).toBeLessThan(u.hp);
});

it('F-02: absent authored delayed policy defaults to none', () => {
  const b = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, enemies: [{ template: 'wolf', at: { x: 4, y: 3 } }] });
  const authored = { ...SKILLS.hellfire_sigil! };
  delete authored.allowedReactions;
  expect(resolveSkill(b, b.units[0]!, authored).profile.allowedReactions).toEqual([]);
});

it('F-04: units and armor expose the shared concept/numbers and field provenance contracts', () => {
  for (const item of [...Object.values(UNITS), ...Object.values(ARMOR)]) {
    expect(item.provenance.concept).toBe('source');
    expect(item.provenance.why.length).toBeGreaterThan(20);
    expect(Object.keys(item.fieldProvenance).length).toBeGreaterThan(0);
    for (const field of Object.values(item.fieldProvenance)) expect(field.why.length).toBeGreaterThan(10);
  }
  expect(UNITS.small_rat!.provenance.numbers).toBe('demo');
  expect(UNITS.cultist_mage!.fieldProvenance.name!.status).toBe('demo');
  expect(UNITS.jubal!.fieldProvenance.hpGrowth!.status).toBe('tentative');
  expect(UNITS.jabal!.fieldProvenance.hpGrowth!.status).toBe('demo');
  for (const id of ['light', 'medium', 'heavy'] as const) {
    expect(ARMOR[id].fieldProvenance.armor!.status).toBe('source');
    for (const k of ['mr', 'dodge', 'engagement', 'disengagement']) expect(ARMOR[id].fieldProvenance[k]!.status).toBe('demo');
  }
});

it('X-09: all AP/damage log variants trim floating-point noise consistently', () => {
  const b = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, enemies: [{ template: 'wolf', at: { x: 4, y: 3 } }] });
  const value = 121.66499999999999;
  const effect = castEffect(b, b.units[1]!, { name: 'Fixture', tiles: [], delay: value, damage: value, damageType: 'magic', pctPen: 0 }, []);
  effect.resolveAt = value;
  const events: GameEvent[] = [
    { t: 'turnStart', unitId: 'jubal', clock: value },
    { t: 'turnEnd', unitId: 'jubal', spent: value, delay: value, nextTurnAt: value },
    { t: 'move', unitId: 'jubal', path: [{ x: 1, y: 3 }, { x: 1, y: 2 }], cost: value },
    { t: 'attack', attackerId: 'jubal', name: 'Fixture', tiles: [], apCost: value, targetTile: { x: 1, y: 2 } },
    { t: 'reload', unitId: 'jubal', name: 'Fixture', slot: 0, apCost: value },
    { t: 'swapWeapon', unitId: 'jubal', oldName: 'a', newName: 'b', slot: 1, apCost: value },
    { t: 'status', unitId: 'jubal', status: 'dazed', pushback: value },
    { t: 'effectCast', effect },
    { t: 'effectResolve', effectId: effect.id, name: effect.name, tiles: [], at: effect.resolveAt, hits: [{ unitId: 'jubal', damage: value, hpAfter: value }], escaped: [] },
    { t: 'strike', attackerId: 'wolf', targetId: 'jubal', hitChance: 1, hitRoll: 1, hit: true, reactions: [], avoided: null, raw: value, damage: value, effectiveDefense: value, hpAfter: value },
  ];
  for (const event of events) {
    expect(describeEvent(b, event)).toContain('121.7');
    expect(describeEvent(b, event)).not.toMatch(/\d+\.\d{2,}/);
  }
  expect(formatAp(49.998)).toBe('50'); expect(formatAp(-0.001)).toBe('0');
});
