import { expect, it } from 'vitest';
import { encounterById } from '../content/encounters';
import { botAction, enemyAction } from './ai';
import { DEFAULT_CONFIG } from './config';
import { applyAction, createBattle } from './engine';
import { attackOptions, reachable } from './queries';
import { lineOfSight, skillReady, unitById } from './state';
import { testBattle } from './testkit';
import type { Action, BattleState } from './types';

function bossTurn(s: BattleState): BattleState {
  for (let i = 0; i < 1000 && s.active?.unitId !== 'boss'; i++) {
    s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
  }
  expect(s.active?.unitId).toBe('boss');
  return s;
}

it('D-12 same-cover camping increments, changing cover resets, exposure clears', () => {
  let s = testBattle({ rows: ['.......', '.......', '..o.o..', '.......', '.......', '.......'], jubal: { x: 0, y: 5 }, allies: [{ template: 'hired_archer', id: 'archer', at: { x: 1, y: 4 } }], enemies: [{ template: 'nephilim', id: 'boss', at: { x: 3, y: 1 } }], boss: { eye: { x: 3, y: 1 }, sweepCols: [1, 5], sweepRowStart: 2 }, config: { bossBreakFreeAt: 0 } });
  s = bossTurn(s);
  expect(s.memory['hidden:archer']).toBe(1);
  s = bossTurn(applyAction(s, { type: 'endTurn', unitId: 'boss' }).state);
  expect(s.memory['hidden:archer']).toBe(2);
  unitById(s, 'archer').pos = { x: 5, y: 4 };
  expect(lineOfSight(s, s.boss!.eye, unitById(s, 'archer').pos)).toBe(false);
  s = bossTurn(applyAction(s, { type: 'endTurn', unitId: 'boss' }).state);
  expect(s.memory['hidden:archer']).toBe(1);
  unitById(s, 'archer').pos = { x: 3, y: 4 };
  s = bossTurn(applyAction(s, { type: 'endTurn', unitId: 'boss' }).state);
  expect(s.memory['hidden:archer']).toBe(0);
});

it('A-01 reviewer bait policy now draws rock throws and damages the exposed archer', () => {
  let s = createBattle(encounterById('nephilim'), { weaponId: 'daggers', armor: 'light' }, DEFAULT_CONFIG, 2).state;
  const mix: Record<string, number> = {};
  let archerDamage = 0;
  for (let i = 0; i < 1200 && s.outcome === 'ongoing'; i++) {
    const u = unitById(s, s.active!.unitId), active = s.active!;
    let a: Action = { type: 'endTurn', unitId: u.id };
    if (u.side === 'enemy') {
      a = enemyAction(s);
      if (a.type === 'skill') mix[a.skillId] = (mix[a.skillId] ?? 0) + 1;
    } else if (u.id === 'jabal') a = botAction(s);
    else if (u.id === 'jubal') {
      const dest = { x: 4, y: s.effects.some((e) => e.name === 'Sweeping Arm') ? 5 : 4 };
      if (reachable(s, u.id).has(`${dest.x},${dest.y}`) && (u.pos.x !== dest.x || u.pos.y !== dest.y)) a = { type: 'move', unitId: u.id, to: dest };
      else if (u.pos.y > 5 && !active.moved) {
        const r = [...reachable(s, u.id).values()].sort((x, y) => x.path.at(-1)!.y - y.path.at(-1)!.y)[0]!;
        if (r.path.length > 1) a = { type: 'move', unitId: u.id, to: r.path.at(-1)! };
      }
    } else if (u.id === 'archer') {
      if (u.pos.x !== 5 || u.pos.y !== 5) {
        if (reachable(s, u.id).has('5,5')) a = { type: 'move', unitId: u.id, to: { x: 5, y: 5 } };
      } else if (!active.acted) {
        const p = attackOptions(s, u)[0];
        if (p) a = skillReady(s, u, 'aimed_shot') ? { type: 'skill', unitId: u.id, skillId: 'aimed_shot', target: p.anchor } : { type: 'attack', unitId: u.id, target: p.anchor };
      }
    }
    const r = applyAction(s, a);
    for (const e of r.events) if (e.t === 'strike' && e.targetId === 'archer') archerDamage += e.damage ?? 0;
    s = r.state;
  }
  expect(mix.rock_throw).toBeGreaterThan(0);
  expect(archerDamage).toBeGreaterThan(0);
  console.log('bait replay', { mix, archerDamage, clock: s.clock, outcome: s.outcome });
});
