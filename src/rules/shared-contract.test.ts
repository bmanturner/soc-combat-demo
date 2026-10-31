import { describe, expect, it } from 'vitest';
import { SKILLS } from '../content/gear';
import { applyAction, castEffect, strike } from './engine';
import { tileDanger, plannedActionAp } from './ai';
import { escapeOutlook, expectedStrike, previewAttack, previewSkill, projectedNextTurn, timelineEntries } from './queries';
import { actionApCost, delayedDamage, resolveSkill, unitActsBefore } from './resolvers';
import { isFlanked, unitById } from './state';
import { OPEN_7x7, testBattle } from './testkit';

const duel = () => testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 4, y: 3 }, initiative: 999 }], config: { critChance: 0, reactionsEnabled: false } });
describe('shared combat contract', () => {
  it('ability reaction metadata controls resolution and preview together', () => {
    const b = duel(); b.config.reactionsEnabled = true;
    const u = b.units[0]!, t = b.units[1]!;
    t.dodge = t.parry = t.block = 1;
    const profile = { ...u.attack, allowedReactions: [] };
    expect(expectedStrike(b, u, t, profile).avoidChance).toBe(0);
    const hit = strike(b, u, t, profile, 0, []);
    expect(hit.hit).toBe(true); expect(hit.reactions).toEqual([]);
    expect(hit.damage).toBe(expectedStrike(b, u, t, profile).damageIfLands);
    const skill = { ...SKILLS.throwing_knife!, allowedReactions: ['parry' as const, 'block' as const] };
    expect(resolveSkill(b, u, skill).profile.allowedReactions).toEqual(['block']);
  });
  it('skill-specific reaction metadata does not inherit the weapon policy', () => {
    const b = duel(); b.config.reactionsEnabled = true;
    b.units[0]!.personalSkills.push({ id: 'shield_bash', readyAt: 0 });
    b.units[0]!.attack.allowedReactions = ['block'];
    const target = b.units[1]!; target.dodge = target.parry = target.block = 1;
    const original = SKILLS.shield_bash!;
    SKILLS.shield_bash = { ...original, allowedReactions: [] };
    try {
      const p = previewSkill(b, b.units[0]!, 'shield_bash', target.pos)!;
      expect(p.targets[0]!.avoidChance).toBe(0);
      const hit = applyAction(b, { type: 'skill', unitId: 'jubal', skillId: 'shield_bash', target: target.pos }).events.find(e => e.t === 'strike');
      expect(hit).toMatchObject({ hit: true, reactions: [], damage: p.targets[0]!.damageIfLands });
    } finally { SKILLS.shield_bash = original; }
  });
  it('zero raw strike and zero preview damage stay zero', () => {
    const b = duel(), u = b.units[0]!, t = b.units[1]!;
    u.attack.damage = 0;
    expect(previewAttack(b, u, t.pos)!.targets[0]!.damageIfLands).toBe(0);
    expect(strike(b, u, t, u.attack, 0, []).damage).toBe(0);
  });
  it('E/W melee pair flanks; replacing either flank with a ranged attacker removes flanking', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 3 }, allies: [{ template: 'jabal', at: { x: 4, y: 3 } }], enemies: [{ template: 'wolf', at: { x: 3, y: 3 } }] });
    const t = unitById(b, 'wolf');
    expect(isFlanked(b, t)).toBe(true);
    unitById(b, 'jubal').canEngage = false; // equipment-level ranged threat, not selected mode
    expect(isFlanked(b, t)).toBe(false);
  });
  it('timeline golden: ten movement plus seven reaction AP with no action projects 42 (17 + 25 no-action surcharge), not Wait price', () => {
    let b = duel(); b.active!.reactionSpent = 7;
    b = applyAction(b, { type: 'move', unitId: 'jubal', to: { x: 3, y: 2 } }).state;
    expect(projectedNextTurn(b, 0)).toBe(42);
    const ended = applyAction(b, { type: 'endTurn', unitId: 'jubal' });
    expect(ended.events.find(e => e.t === 'turnEnd')).toMatchObject({ spent: 17, delay: 42, nextTurnAt: 42 });
    expect(timelineEntries(ended.state).map(x => [x.id, x.at])).toEqual([['jubal', 0], ['wolf', 957]]);
  });
  it.each([true, false])('effect and unit tie predicates honor configuration %s', first => {
    const b = duel(), u = b.units[0]!, t = b.units[1]!;
    b.config.tieUnitBeforeEffect = first; b.config.tiePlayerFirst = first;
    expect(unitActsBefore(b, u, 50, { kind: 'effect', at: 50 })).toBe(first);
    expect(unitActsBefore(b, u, 50, { kind: 'unit', unit: t, at: 50 })).toBe(first);
  });
  it('escape uses instant movement even when walking costs more than impact margin', () => {
    const b = duel(); b.units[1]!.pos = { x: 6, y: 6 };
    const fx = castEffect(b, b.units[1]!, { name: 'blast', tiles: [b.units[0]!.pos], delay: 26, damage: 20, damageType: 'magic', pctPen: 0 }, []);
    expect(escapeOutlook(b, b.units[0]!, fx)).toMatchObject({ actsBefore: true, reachableSafe: true, canEscape: true, disengageRisk: 0 });
    expect(tileDanger(b, b.units[0]!, b.units[0]!.pos, 25, false)).toBe(0);
  });
  it('escape outlook reports unavoidable disengagement risk rather than guaranteed safety', () => {
    const b = duel();
    const tiles = OPEN_7x7.flatMap((row, y) => [...row].map((_, x) => ({ x, y }))).filter(t => Math.max(Math.abs(t.x - 4), Math.abs(t.y - 3)) <= 1);
    const fx = castEffect(b, b.units[1]!, { name: 'contact blast', tiles, delay: 100, damage: 20, damageType: 'magic', pctPen: 0 }, []);
    const outlook = escapeOutlook(b, b.units[0]!, fx);
    expect(outlook.canEscape).toBe(true); expect(outlook.disengageRisk).toBeGreaterThan(0);
    expect(tileDanger(b, b.units[0]!, b.units[0]!.pos, 25, false)).toBeGreaterThan(0);
  });
  it('auto-end respects leftover fractional tiles, explicit opt-out and one turnEnd only', () => {
    const b = duel(); b.active!.moveSpent = 45; b.units[0]!.moveApPerTile = 15;
    const done = applyAction(b, { type: 'attack', unitId: 'jubal', target: b.units[1]!.pos });
    expect(done.events.filter(e => e.t === 'turnEnd')).toHaveLength(1);
    b.config.autoEndTurn = false;
    expect(applyAction(b, { type: 'attack', unitId: 'jubal', target: b.units[1]!.pos }).state.active?.acted).toBe(true);
  });
  it('inactive bow hypothetical attack and skill costs include movement', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, weapon: 'hunting_bow', enemies: [{ template: 'wolf', at: { x: 4, y: 0 } }] });
    const u = b.units[0]!; b.active = null;
    expect(previewAttack(b, u, { x: 4, y: 0 }, { x: 0, y: 1 })!.apCost).toBe(125);
    expect(previewSkill(b, u, 'aimed_shot', { x: 4, y: 0 }, { x: 0, y: 1 })!.apCost).toBe(150);
    expect(plannedActionAp(b, u, 'aimed_shot', true)).toBe(actionApCost(b, u, SKILLS.aimed_shot!, true));
  });
  it('delayed preview damage includes side scaling and flanking for AI ally risk', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 3 }, weapon: 'cultist_staff', allies: [{ template: 'jabal', at: { x: 4, y: 3 } }], enemies: [{ template: 'wolf', at: { x: 3, y: 3 } }], config: { playerDamageMult: 2 } });
    const u = b.units[0]!, t = unitById(b, 'wolf');
    const p = previewSkill(b, u, 'hellfire_sigil', t.pos)!;
    const target = p.targets.find(x => x.unitId === t.id)!;
    expect(target.flanked).toBe(true);
    expect(target.damageIfLands).toBe(delayedDamage(b, resolveSkill(b, u, SKILLS.hellfire_sigil!).profile, t));
    expect(target.damageIfLands).toBe(148);
  });
});
