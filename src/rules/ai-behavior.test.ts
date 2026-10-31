import { describe, expect, it } from 'vitest';
import { botAction, enemyAction, plannedActionAp, pathFailureCost, partyFocus } from './ai';
import { applyAction } from './engine';
import { previewAttack, previewSkill } from './queries';
import { distToUnit, lineOfSight, unitById } from './state';
import { OPEN_7x7, testBattle } from './testkit';
import type { BattleState } from './types';

function activate(s: BattleState, id: string) {
  s.active = { ...s.active!, unitId: id };
}

describe('AI intent regressions', () => {
  it('expert melee focus does not route through a healthy screen for a lower-HP backline', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 5 }, weapon: 'daggers', enemies: [
      { template: 'cultist_fighter', id: 'guard', at: { x: 3, y: 3 } },
      { template: 'cultist_mage', id: 'seer', at: { x: 3, y: 0 } },
    ] });
    const u = unitById(s, 'jubal');
    expect(partyFocus(s, u, 'expert')?.id).toBe('guard');
    unitById(s, 'seer').pos = { x: 4, y: 3 };
    expect(partyFocus(s, u, 'expert')?.id).toBe('seer');
    unitById(s, 'seer').pos = { x: 3, y: 0 };
    u.attack.ranged = true;
    expect(partyFocus(s, u, 'expert')?.id).toBe('seer');
    expect(partyFocus(s, u, 'novice')?.id).toBe('guard');
  });

  it('A-02 Seer prices allied KO risk but still permits a self-sigil lure', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 3 }, allies: [{ template: 'jabal', id: 'jabal', at: { x: 4, y: 3 } }], enemies: [{ template: 'cultist_mage', id: 'seer', at: { x: 3, y: 3 } }] });
    activate(s, 'seer');
    unitById(s, 'jubal').dazed = true;
    s.active!.movementLocked = true;
    const seer = unitById(s, 'seer');
    const lure = enemyAction(s);
    expect(lure).toMatchObject({ type: 'skill', skillId: 'hellfire_sigil' });
    if (lure.type === 'skill') expect(previewSkill(s, seer, lure.skillId, lure.target)?.targets.some((t) => t.unitId === seer.id)).toBe(true);
    seer.hp = 1;
    const cautious = enemyAction(s);
    if (cautious.type === 'skill' && cautious.skillId === 'hellfire_sigil') expect(previewSkill(s, seer, cautious.skillId, cautious.target)?.targets.some((t) => t.unitId === seer.id)).toBe(false);
  });

  it('novice ignores future boss sweeps but both policies react to visible telegraphs', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'polearm', config: { sweepDelay: 75, sweepDamage: 500 }, enemies: [{ template: 'nephilim', id: 'boss', at: { x: 3, y: 1 }, initiative: 0 }], boss: { eye: { x: 3, y: 1 }, sweepCols: [1, 5], sweepRowStart: 2 } });
    s.active!.movementLocked = true;
    expect(botAction(s, 'expert').type).toBe('endTurn');
    expect(botAction(s, 'novice').type).not.toBe('endTurn');
    s.effects.push({ id: 'visible', name: 'Sweeping Arm', sourceId: 'boss', tiles: [{ x: 3, y: 3 }], castAt: 0, resolveAt: 75, damage: 500, damageType: 'physical', pctPen: 0.5, threatenedAtCast: ['jubal'] });
    expect(botAction(s, 'novice').type).toBe('endTurn');
  });

  it('A-02 enemy also refuses an ally-only pattern', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 6, y: 6 }, enemies: [{ template: 'cultist_fighter', id: 'guard', at: { x: 1, y: 1 } }, { template: 'wolf', id: 'wolf', at: { x: 2, y: 1 } }], config: { friendlyFire: true } });
    activate(s, 'guard');
    unitById(s, 'guard').attack.pattern = 'arc5';
    s.active!.movementLocked = true;
    expect(enemyAction(s)).toMatchObject({ type: 'endTurn' });
  });

  it('D-05 wolf pursues the strictly closest healthy body rather than a distant kill', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 2 }, allies: [{ template: 'jabal', id: 'jabal', at: { x: 5, y: 3 } }], enemies: [{ template: 'wolf', id: 'wolf', at: { x: 3, y: 3 } }] });
    unitById(s, 'jabal').hp = 1;
    unitById(s, 'jubal').armor = 10000;
    activate(s, 'wolf');
    expect(enemyAction(s)).toMatchObject({ type: 'attack', target: { x: 3, y: 2 } });
  });

  it('party utility values damage per AP rather than a larger burst', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'two_handed', enemies: [{ template: 'wolf', id: 'wolf', at: { x: 3, y: 2 } }], config: { reactionsEnabled: false } });
    const u = unitById(s, 'jubal');
    u.attack.apCost = 25;
    u.attack.damage = 20;
    unitById(s, 'wolf').hp = 1000;
    s.active!.movementLocked = true;
    expect(botAction(s)).toMatchObject({ type: 'attack' });
  });

  it('planned bow AP charges either approach or retreat once, including Aimed Shot', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, allies: [{ template: 'hired_archer', id: 'archer', at: { x: 1, y: 1 } }], enemies: [{ template: 'wolf', at: { x: 6, y: 6 } }] });
    activate(s, 'archer');
    const u = unitById(s, 'archer');
    expect(plannedActionAp(s, u, null, false)).toBe(75);
    expect(plannedActionAp(s, u, null, true)).toBe(125);
    expect(plannedActionAp(s, u, 'aimed_shot', true)).toBe(150);
    s.active!.moved = true;
    expect(plannedActionAp(s, u, null, true)).toBe(125);
  });

  it('risky retreat prices the danger on a held step instead of assuming safety', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 1 }, enemies: [{ template: 'wolf', id: 'wolf', at: { x: 1, y: 2 } }] });
    const r = { path: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], cost: 20, risks: [{ index: 1, engagerIds: ['wolf'], chance: 0.9 }] };
    expect(pathFailureCost(s, r, (p) => p.x === 2 ? 500 : 0)).toBeGreaterThanOrEqual(450);
    expect(pathFailureCost(s, { ...r, risks: [] }, () => 500)).toBe(0);
  });

  it('D-05 wolves bite closest body even when a farther kill is available', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 2 }, allies: [{ template: 'jabal', id: 'jabal', at: { x: 4, y: 3 } }], enemies: [{ template: 'wolf', id: 'wolf', at: { x: 3, y: 3 } }] });
    unitById(s, 'jabal').hp = 1;
    // Closest ties choose lowest HP, not the highest damage/avoidance opportunity.
    unitById(s, 'jabal').armor = 10000;
    activate(s, 'wolf');
    expect(enemyAction(s)).toMatchObject({ type: 'attack', target: { x: 4, y: 3 } });
  });

  it('A-02 party never declares an ally-only attack', () => {
    let s = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 1 }, weapon: 'two_handed', allies: [{ template: 'jabal', id: 'jabal', at: { x: 2, y: 1 } }], enemies: [{ template: 'wolf', id: 'wolf', at: { x: 6, y: 6 } }], config: { friendlyFire: true } });
    for (let i = 0; i < 8 && s.active?.unitId === 'jubal'; i++) {
      const a = botAction(s);
      if (a.type === 'attack' || a.type === 'skill') {
        const u = unitById(s, a.unitId);
        const p = a.type === 'attack' ? previewAttack(s, u, a.target) : previewSkill(s, u, a.skillId, a.target);
        expect(p?.targets.some((t) => unitById(s, t.unitId).side !== u.side)).toBe(true);
      }
      s = applyAction(s, a).state;
    }
  });

  it('A-03 Seer approaches a firing position beyond one movement budget', () => {
    let s = testBattle({ rows: ['.......', ...Array<string>(13).fill('...#...'), '.......'], jubal: { x: 1, y: 9 }, allies: [{ template: 'jabal', id: 'jabal', at: { x: 1, y: 5 }, initiative: 0 }], enemies: [{ template: 'cultist_mage', id: 'seer', at: { x: 5, y: 7 }, initiative: 0 }] });
    let casts = 0;
    for (let i = 0; i < 150 && s.outcome === 'ongoing'; i++) {
      const u = unitById(s, s.active!.unitId);
      const a = u.side === 'player' ? { type: 'endTurn' as const, unitId: u.id } : enemyAction(s);
      if (a.type === 'skill') casts++;
      s = applyAction(s, a).state;
    }
    expect(casts).toBeGreaterThan(0);
  });

  it('A-06 guardian stays tethered on the threatened side of the Seer', () => {
    const s = testBattle({ rows: Array<string>(13).fill('.............'), jubal: { x: 1, y: 6 }, enemies: [{ template: 'cultist_mage', id: 'seer', at: { x: 10, y: 6 } }, { template: 'cultist_fighter', id: 'guard', at: { x: 10, y: 8 } }] });
    activate(s, 'guard');
    const a = enemyAction(s);
    expect(a.type).toBe('move');
    if (a.type === 'move') expect(a.to.x).toBeGreaterThanOrEqual(7);
    unitById(s, 'seer').ko = true;
    const pursuit = enemyAction(s);
    expect(pursuit.type).toBe('move');
    if (pursuit.type === 'move') expect(pursuit.to.x).toBeLessThan(7);
  });

  it('Brood Mother calls the brood when ready and bites when she cannot', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'rat_brood_mother', id: 'mother', at: { x: 3, y: 3 } }] });
    activate(s, 'mother');
    expect(enemyAction(s)).toMatchObject({ type: 'skill', skillId: 'call_the_brood' });
    unitById(s, 'mother').personalSkills[0]!.readyAt = 999;
    unitById(s, 'jubal').pos = { x: 2, y: 3 };
    expect(enemyAction(s).type).toBe('attack');
  });

  it('Bandit archer shoots from range and steps out of melee to a firing tile', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 1, y: 3 }, enemies: [{ template: 'bandit_archer', id: 'archer', at: { x: 5, y: 3 } }] });
    activate(s, 'archer');
    expect(enemyAction(s)).toMatchObject({ type: 'attack', target: { x: 1, y: 3 } });
    const jubal = unitById(s, 'jubal');
    jubal.pos = { x: 4, y: 3 };
    const step = enemyAction(s);
    expect(step.type).toBe('move');
    if (step.type === 'move') expect(distToUnit(step.to, jubal)).toBeGreaterThanOrEqual(2);
  });

  it('Bandit archer moves around a wall to regain line of sight', () => {
    const s = testBattle({ rows: ['.......', '...#...', '...#...', '...#...', '...#...', '...#...', '.......'], jubal: { x: 1, y: 3 }, enemies: [{ template: 'bandit_archer', id: 'archer', at: { x: 5, y: 3 } }] });
    activate(s, 'archer');
    const step = enemyAction(s);
    expect(step.type).toBe('move');
    if (step.type === 'move') {
      expect(lineOfSight(s, step.to, { x: 1, y: 3 })).toBe(true);
      expect(distToUnit(step.to, unitById(s, 'jubal'))).toBeGreaterThanOrEqual(2);
      expect(distToUnit(step.to, unitById(s, 'jubal'))).toBeLessThanOrEqual(8);
    }
  });
});
