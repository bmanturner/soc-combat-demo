// Enemy AI and a competent "player bot" for headless balance sims. Each call returns the next single
// action for the active unit; callers loop until it returns endTurn. Pure: reads state, never mutates it.

import { SKILLS } from '../content/gear';
import { DIRS8, add, cheb, eq, key, type Vec } from './geometry';
import { attackOptions, previewSkill, reachable, skillOptions, type AttackPreview, type Reach } from './queries';
import { alive, distToUnit, lineOfSight, occupant, skillReady, tilesOf, unitById, walkable } from './state';
import { skillTargeting, sweepTiles } from './targeting';
import type { Action, BattleState, UnitState } from './types';

const END = (u: UnitState): Action => ({ type: 'endTurn', unitId: u.id });

/** BFS distance (in orthogonal steps) from goal tiles over walkable terrain, ignoring units. */
export function distanceField(state: BattleState, goals: Vec[]): Map<string, number> {
  const dist = new Map<string, number>();
  const q: Vec[] = [];
  for (const g of goals) {
    if (!walkable(state, g)) continue;
    dist.set(key(g), 0);
    q.push(g);
  }
  const dirs = state.config.diagonalMovement ? DIRS8 : DIRS8.filter((_, i) => i % 2 === 0);
  while (q.length) {
    const c = q.shift()!;
    const d = dist.get(key(c))!;
    for (const dd of dirs) {
      const n = add(c, dd);
      if (!walkable(state, n) || dist.has(key(n))) continue;
      dist.set(key(n), d + 1);
      q.push(n);
    }
  }
  return dist;
}

function meleeGoals(state: BattleState, target: UnitState): Vec[] {
  const out: Vec[] = [];
  for (const t of tilesOf(target)) for (const d of DIRS8) {
    const p = add(t, d);
    if (walkable(state, p)) out.push(p);
  }
  return out;
}

function nearestEnemy(state: BattleState, u: UnitState): UnitState | null {
  let best: UnitState | null = null;
  let bd = Infinity;
  for (const e of state.units) {
    if (!alive(e) || e.side === u.side) continue;
    const d = distToUnit(u.pos, e);
    if (d < bd || (d === bd && best && e.hp < best.hp)) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Projected delay if the active unit spends `extra` more AP. */
function projected(state: BattleState, extra: number, u: UnitState): number {
  const a = state.active!;
  const spent = a.moveSpent + a.actionSpent + a.reactionSpent + extra;
  return Math.max(spent, u.massive ? state.config.bossTurnAp : state.config.minTurnDelay);
}

/** True if standing on `tile` until our next turn (in `delay` AP) gets us hit by a known or predictable effect. */
export function tileDanger(state: BattleState, u: UnitState, tile: Vec, delay: number, anticipateBoss: boolean): number {
  const cfg = state.config;
  const lands = (at: number) => at < delay - 1e-9 || (Math.abs(at - delay) <= 1e-9 && !cfg.tieUnitBeforeEffect);
  let danger = 0;
  for (const e of state.effects) {
    if (!e.tiles.some((t) => eq(t, tile))) continue;
    const src = state.units.find((x) => x.id === e.sourceId);
    if (src && src.side === u.side && !cfg.delayedHitsAllies) continue;
    if (lands(e.resolveAt - state.clock)) danger += e.damage;
  }
  if (anticipateBoss && state.boss) {
    const boss = state.units.find((x) => x.ai === 'nephilim' && alive(x));
    if (boss && boss.side !== u.side && sweepTiles(state).some((t) => eq(t, tile))) {
      const actsIn = boss.nextTurnAt - state.clock;
      if (actsIn < delay && lands(actsIn + cfg.sweepDelay)) danger += cfg.sweepDamage;
    }
  }
  return danger;
}

function scoreAttack(p: AttackPreview, u: UnitState, focus: UnitState | null): number {
  let s = 0;
  for (const t of p.targets) {
    if (t.unitId === u.id) continue;
    const mult = focus && t.unitId === focus.id ? 1.6 : 1;
    s += t.expectedDamage * mult + (t.kills ? 35 * t.landChance : 0);
  }
  return s;
}

interface Option {
  preview: AttackPreview;
  skillId: string | null;
  score: number;
}

function optionsFrom(state: BattleState, u: UnitState, from: Vec, focus: UnitState | null, allowSkills: boolean): Option[] {
  const out: Option[] = attackOptions(state, u, from).map((p) => ({ preview: p, skillId: null, score: scoreAttack(p, u, focus) }));
  if (allowSkills) {
    for (const s of u.skills) {
      const def = SKILLS[s.id];
      if (!def || def.special || def.kind === 'sigil' || !skillReady(state, u, s.id)) continue;
      for (const p of skillOptions(state, u, s.id, from)) {
        let score = scoreAttack(p, u, focus);
        if (def.applies === 'dazed') score += 18; // tempo is worth a lot in an AP game
        if (def.kind === 'shove' || def.kind === 'hook') score += 6;
        out.push({ preview: p, skillId: s.id, score: score * (def.apCost <= u.attack.apCost ? 1 : u.attack.apCost / def.apCost + 0.15) });
      }
    }
  }
  return out;
}

function toAction(u: UnitState, o: Option): Action {
  return o.skillId ? { type: 'skill', unitId: u.id, skillId: o.skillId, target: o.preview.anchor } : { type: 'attack', unitId: u.id, target: o.preview.anchor };
}

function approach(state: BattleState, u: UnitState, target: UnitState, reach: Map<string, Reach>, avoid: (p: Vec, cost: number) => number): Action {
  const field = distanceField(state, meleeGoals(state, target));
  const here = field.get(key(u.pos)) ?? Infinity;
  let best: { p: Vec; d: number; cost: number } | null = null;
  for (const r of reach.values()) {
    const p = r.path[r.path.length - 1]!;
    if (eq(p, u.pos)) continue;
    const d = (field.get(key(p)) ?? 999) + avoid(p, r.cost) / 25;
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && r.cost < best.cost)) best = { p, d, cost: r.cost };
  }
  if (best && best.d < here) return { type: 'move', unitId: u.id, to: best.p };
  return END(u);
}

// ---------------- Enemy behaviours ----------------

function fleeAction(state: BattleState, u: UnitState): Action {
  const reach = reachable(state, u.id);
  let best: { p: Vec; d: number } | null = null;
  for (const r of reach.values()) {
    const p = r.path[r.path.length - 1]!;
    let d = Infinity;
    for (const e of state.units) if (alive(e) && e.side !== u.side) d = Math.min(d, distToUnit(p, e));
    if (!best || d > best.d) best = { p, d };
  }
  if (best && !eq(best.p, u.pos)) return { type: 'move', unitId: u.id, to: best.p };
  return END(u);
}

function meleeBrute(state: BattleState, u: UnitState, focus: UnitState | null): Action {
  const a = state.active!;
  if (u.feared) return a.moved ? END(u) : fleeAction(state, u);
  const target = focus ?? nearestEnemy(state, u);
  if (!target) return END(u);
  const avoidAt = (p: Vec, extraAp: number) => tileDanger(state, u, p, projected(state, extraAp, u), false);
  if (!a.acted) {
    const here = optionsFrom(state, u, u.pos, target, true).filter((o) => avoidAt(u.pos, o.preview.apCost) === 0);
    const bestHere = here.sort((x, y) => y.score - x.score)[0];
    if (!a.moved && !a.movementLocked) {
      const reach = reachable(state, u.id);
      let bestMove: { to: Vec; opt: Option; value: number } | null = null;
      for (const r of reach.values()) {
        const p = r.path[r.path.length - 1]!;
        if (eq(p, u.pos)) continue;
        for (const o of optionsFrom(state, u, p, target, true)) {
          if (avoidAt(p, r.cost + o.preview.apCost) > 0) continue;
          const value = o.score - r.cost * 0.02;
          if (!bestMove || value > bestMove.value) bestMove = { to: p, opt: o, value };
        }
      }
      if (bestMove && (!bestHere || bestMove.value > bestHere.score + 2)) return { type: 'move', unitId: u.id, to: bestMove.to };
    }
    if (bestHere && bestHere.score > 0) return toAction(u, bestHere);
    if (!a.movementLocked && state.config.movementBudget - a.moveSpent >= u.moveApPerTile) {
      return approach(state, u, target, reachable(state, u.id), (p, c) => avoidAt(p, c));
    }
    return END(u);
  }
  // After acting: step out of anything about to land on us.
  if (!a.movementLocked && avoidAt(u.pos, 0) > 0) {
    const reach = reachable(state, u.id);
    for (const r of [...reach.values()].sort((x, y) => x.cost - y.cost)) {
      const p = r.path[r.path.length - 1]!;
      if (avoidAt(p, r.cost) === 0) return { type: 'move', unitId: u.id, to: p };
    }
  }
  return END(u);
}

function guardianFocus(state: BattleState, u: UnitState): UnitState | null {
  // Zealots go for whoever is closest to their Seer; otherwise the nearest enemy.
  const seer = state.units.find((x) => alive(x) && x.side === u.side && x.ai === 'caster');
  const foes = state.units.filter((x) => alive(x) && x.side !== u.side);
  if (!seer || foes.length === 0) return nearestEnemy(state, u);
  return foes.reduce((b, x) => (distToUnit(x.pos, seer) < distToUnit(b.pos, seer) ? x : b));
}

function casterAction(state: BattleState, u: UnitState): Action {
  const a = state.active!;
  const foes = state.units.filter((x) => alive(x) && x.side !== u.side);
  if (foes.length === 0) return END(u);
  const nearestDist = (p: Vec) => Math.min(...foes.map((f) => distToUnit(p, f)));
  const avoidAt = (p: Vec, extraAp: number) => tileDanger(state, u, p, projected(state, extraAp, u), false);
  if (!a.acted) {
    // Brand the floor where it catches the most of them and the fewest of us.
    if (skillReady(state, u, 'hellfire_sigil') && u.skills.some((s) => s.id === 'hellfire_sigil')) {
      let best: { at: Vec; score: number } | null = null;
      for (let y = 0; y < state.map.height; y++)
        for (let x = 0; x < state.map.width; x++) {
          const p = { x, y };
          const tg = skillTargeting(state, u, SKILLS.hellfire_sigil!, p);
          if (!tg.valid || !tg.area) continue;
          let foesHit = 0;
          let alliesHit = 0;
          for (const t of tg.area) {
            const o = occupant(state, t);
            if (!o) continue;
            if (o.side !== u.side) foesHit += 1;
            else alliesHit += 1;
          }
          const score = foesHit * 3 - alliesHit * 2 - (eq(p, u.pos) ? 10 : 0);
          if (foesHit >= 1 && (!best || score > best.score)) best = { at: p, score };
        }
      if (best && best.score >= 3 && (best.score >= 6 || foes.length === 1 || foes.some((f) => f.dazed))) {
        return { type: 'skill', unitId: u.id, skillId: 'hellfire_sigil', target: best.at };
      }
    }
    if (skillReady(state, u, 'daze_bolt')) {
      const shots = foes
        .map((f) => ({ f, p: previewSkill(state, u, 'daze_bolt', f.pos) }))
        .filter((x) => x.p)
        .sort((x, y) => Number(x.f.dazed) - Number(y.f.dazed) || x.f.hp / x.f.maxHp - y.f.hp / y.f.maxHp);
      if (shots[0] && (a.moved || nearestDist(u.pos) >= 2)) return { type: 'skill', unitId: u.id, skillId: 'daze_bolt', target: shots[0].f.pos };
      if (!a.moved && !a.movementLocked) {
        // Find a spot at range with sight, as far from melee as possible.
        const reach = reachable(state, u.id);
        let best: { p: Vec; v: number } | null = null;
        for (const r of reach.values()) {
          const p = r.path[r.path.length - 1]!;
          const canShoot = foes.some((f) => previewSkill(state, u, 'daze_bolt', f.pos, p));
          if (!canShoot) continue;
          const v = nearestDist(p) * 2 - r.cost * 0.02 - avoidAt(p, r.cost + 100);
          if (!best || v > best.v) best = { p, v };
        }
        if (best && !eq(best.p, u.pos)) return { type: 'move', unitId: u.id, to: best.p };
      }
    }
  }
  // Keep distance 3+ from the nearest foe, preferring safety.
  if (!a.movementLocked && state.config.movementBudget - a.moveSpent >= u.moveApPerTile && nearestDist(u.pos) <= 2) {
    const reach = reachable(state, u.id);
    let best: { p: Vec; v: number } | null = null;
    for (const r of reach.values()) {
      const p = r.path[r.path.length - 1]!;
      const v = Math.min(nearestDist(p), 4) * 10 - r.cost * 0.05 - avoidAt(p, r.cost);
      if (!best || v > best.v) best = { p, v };
    }
    if (best && !eq(best.p, u.pos)) return { type: 'move', unitId: u.id, to: best.p };
  }
  if (!a.acted) {
    const staff = optionsFrom(state, u, u.pos, null, false).sort((x, y) => y.score - x.score)[0];
    if (staff) return toAction(u, staff);
  }
  return END(u);
}

function nephilimAction(state: BattleState, u: UnitState): Action {
  const a = state.active!;
  if (a.acted) return END(u);
  const foes = state.units.filter((x) => alive(x) && x.side !== u.side);
  const zone = sweepTiles(state);
  if (foes.some((f) => zone.some((t) => eq(t, f.pos)))) {
    return { type: 'skill', unitId: u.id, skillId: 'nephilim_sweep', target: zone[0] ?? u.pos };
  }
  const camper = foes.find((f) => f.attack.ranged && (state.memory[`hidden:${f.id}`] ?? 0) >= state.config.coverCampTurns);
  if (camper) return { type: 'skill', unitId: u.id, skillId: 'rockfall', target: camper.pos };
  const eye = state.boss?.eye ?? u.pos;
  const exposed = foes
    .filter((f) => lineOfSight(state, eye, f.pos) && cheb(eye, f.pos) >= 2)
    .sort((x, y) => Number(y.attack.ranged) - Number(x.attack.ranged) || x.hp - y.hp);
  if (exposed[0]) return { type: 'skill', unitId: u.id, skillId: 'rock_throw', target: exposed[0].pos };
  return END(u);
}

export function enemyAction(state: BattleState): Action {
  const a = state.active;
  if (!a) throw new Error('no active unit');
  const u = unitById(state, a.unitId);
  switch (u.ai) {
    case 'nephilim':
      return nephilimAction(state, u);
    case 'caster':
      return casterAction(state, u);
    case 'guardian':
      return meleeBrute(state, u, guardianFocus(state, u));
    case 'swarm':
    case 'charger':
    default:
      return meleeBrute(state, u, nearestEnemy(state, u));
  }
}

// ---------------- Player bot (headless sims, "auto" button) ----------------

interface Plan {
  to: Vec;
  opt: Option | null;
  retreat: Vec;
  value: number;
}

function exposureToBoss(state: BattleState, u: UnitState, tile: Vec, delay: number): number {
  const boss = state.units.find((x) => x.ai === 'nephilim' && alive(x));
  if (!boss || !state.boss) return 0;
  const actsIn = boss.nextTurnAt - state.clock;
  if (actsIn >= delay) return 0;
  return lineOfSight(state, state.boss.eye, tile) ? state.config.rockThrowDamage * 0.4 : 0;
}

/** A reasonably competent player: hit, then get out of anything that would land before its next turn. */
export function botAction(state: BattleState): Action {
  const a = state.active;
  if (!a) throw new Error('no active unit');
  const u = unitById(state, a.unitId);
  const foes = state.units.filter((x) => alive(x) && x.side !== u.side);
  if (foes.length === 0) return END(u);
  const focus = foes.reduce((b, f) => (f.hp < b.hp ? f : b));
  const danger = (p: Vec, delay: number) => tileDanger(state, u, p, delay, true) + (u.attack.ranged ? exposureToBoss(state, u, p, delay) : 0);
  const spentNow = a.moveSpent + a.actionSpent + a.reactionSpent;
  const budget = state.config.movementBudget;

  if (a.acted) {
    // Already acted: pick the safest reachable tile, closest to staying put.
    const delay = projected(state, 0, u);
    if (danger(u.pos, delay) === 0 || a.movementLocked) return END(u);
    let best: { p: Vec; v: number } | null = null;
    for (const r of reachable(state, u.id).values()) {
      const p = r.path[r.path.length - 1]!;
      const v = -danger(p, projected(state, r.cost, u)) * 10 - r.cost;
      if (!best || v > best.v) best = { p, v };
    }
    return best && !eq(best.p, u.pos) ? { type: 'move', unitId: u.id, to: best.p } : END(u);
  }

  const startReach = a.movementLocked ? new Map([[key(u.pos), { path: [u.pos], cost: 0, risks: [] }]]) : reachable(state, u.id);
  let bestPlan: Plan | null = null;
  for (const r of startReach.values()) {
    const p = r.path[r.path.length - 1]!;
    const opts = optionsFrom(state, u, p, focus, true);
    for (const o of opts) {
      const afterAttack = r.cost + o.preview.apCost;
      const moveLeft = a.movementLocked ? 0 : budget - a.moveSpent - r.cost;
      const retreatReach = moveLeft >= u.moveApPerTile ? reachable(state, u.id, { budget: moveLeft, from: p }) : new Map([[key(p), { path: [p], cost: 0, risks: [] }]]);
      let bestR: { q: Vec; v: number } | null = null;
      for (const rr of retreatReach.values()) {
        const q = rr.path[rr.path.length - 1]!;
        if (!eq(q, p) && occupant(state, q) && occupant(state, q)!.id !== u.id) continue;
        const delay = Math.max(spentNow + afterAttack + rr.cost, state.config.minTurnDelay);
        const v = -danger(q, delay) * 3 - rr.cost * 0.05;
        if (!bestR || v > bestR.v) bestR = { q, v };
      }
      if (!bestR) continue;
      const tempo = (spentNow + afterAttack) * 0.04;
      const value = o.score + bestR.v - r.cost * 0.02 - tempo;
      if (!bestPlan || value > bestPlan.value) bestPlan = { to: p, opt: o, retreat: bestR.q, value };
    }
  }
  if (bestPlan && bestPlan.value > 0) {
    if (!eq(bestPlan.to, u.pos)) return { type: 'move', unitId: u.id, to: bestPlan.to };
    return toAction(u, bestPlan.opt!);
  }
  // Nothing worth attacking safely: reposition toward the focus while staying safe, or hold.
  if (a.movementLocked) return END(u);
  const reach = reachable(state, u.id);
  if (u.attack.ranged) {
    // Archer: find cover within reach that keeps a shot available next turn.
    let best: { p: Vec; v: number } | null = null;
    for (const r of reach.values()) {
      const p = r.path[r.path.length - 1]!;
      const delay = projected(state, r.cost, u);
      const v = -danger(p, delay) * 3 - r.cost * 0.05 - Math.abs(cheb(p, focus.pos) - 6);
      if (!best || v > best.v) best = { p, v };
    }
    return best && !eq(best.p, u.pos) ? { type: 'move', unitId: u.id, to: best.p } : END(u);
  }
  const dangerNow = danger(u.pos, projected(state, 0, u));
  if (dangerNow > 0) {
    // Standing in something: get out first, closer to the focus if possible.
    const field = distanceField(state, meleeGoals(state, focus));
    let best: { p: Vec; v: number } | null = null;
    for (const r of reach.values()) {
      const p = r.path[r.path.length - 1]!;
      const v = -danger(p, projected(state, r.cost, u)) * 10 - (field.get(key(p)) ?? 50) - r.cost * 0.01;
      if (!best || v > best.v) best = { p, v };
    }
    if (best && !eq(best.p, u.pos)) return { type: 'move', unitId: u.id, to: best.p };
  }
  const act = approach(state, u, focus, reach, (p, c) => danger(p, projected(state, c, u)) * 3);
  if (act.type === 'move' && danger(act.to, projected(state, reach.get(key(act.to))?.cost ?? 0, u)) > dangerNow) return END(u);
  return act;
}
