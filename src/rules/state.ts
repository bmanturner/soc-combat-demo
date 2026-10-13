// Read-only helpers over a BattleState: lookups, terrain, occupancy, flanking, engagement.

import { skillUseReason } from './equipment';
import type { RulesConfig } from './config';
import { CARDINAL_IDX, add, cheb, dir, eq, hasLineOfSight, type Vec } from './geometry';
import type { BattleState, Terrain, UnitState } from './types';

export function unitById(state: BattleState, id: string): UnitState {
  const u = state.units.find((x) => x.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return u;
}

export const alive = (u: UnitState) => !u.ko;
export const enemiesOf = (state: BattleState, u: UnitState) => state.units.filter((x) => alive(x) && x.side !== u.side);
export const alliesOf = (state: BattleState, u: UnitState) => state.units.filter((x) => alive(x) && x.side === u.side && x.id !== u.id);

export function tilesOf(u: UnitState): Vec[] {
  return u.footprint.map((o) => add(u.pos, o));
}

export function inBounds(state: BattleState, p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < state.map.width && p.y < state.map.height;
}

export function terrainAt(state: BattleState, p: Vec): Terrain {
  if (!inBounds(state, p)) return 'wall';
  return state.map.tiles[p.y * state.map.width + p.x] ?? 'wall';
}

export function occupant(state: BattleState, p: Vec): UnitState | undefined {
  return state.units.find((u) => alive(u) && tilesOf(u).some((t) => eq(t, p)));
}

/** Walls and cover block line of sight. Units don't. */
export function blocksSight(state: BattleState, p: Vec): boolean {
  const t = terrainAt(state, p);
  return t === 'wall' || t === 'cover';
}

export function lineOfSight(state: BattleState, a: Vec, b: Vec): boolean {
  return hasLineOfSight(a, b, (p) => blocksSight(state, p));
}

/** Can a unit stand on this tile (ignoring occupancy)? */
export function walkable(state: BattleState, p: Vec): boolean {
  return inBounds(state, p) && terrainAt(state, p) === 'floor';
}

export function distToUnit(p: Vec, u: UnitState): number {
  let best = Infinity;
  for (const t of tilesOf(u)) best = Math.min(best, cheb(p, t));
  return best;
}

export function unitDistance(a: UnitState, b: UnitState): number {
  let best = Infinity;
  for (const t of tilesOf(a)) best = Math.min(best, distToUnit(t, b));
  return best;
}

/** A unit that threatens melee: holds a melee weapon. */
export function isMeleeThreat(u: UnitState): boolean {
  return alive(u) && u.canEngage;
}

/** Flanked: melee enemies on opposite sides (N/S or E/W; diagonals optional). */
export function isFlanked(state: BattleState, u: UnitState, config: RulesConfig = state.config): boolean {
  if (u.footprint.length > 1 || u.ko) return false;
  const pairs: [number, number][] = CARDINAL_IDX.slice(0, 2).map((i) => [i, i + 4]);
  if (config.flankDiagonals) pairs.push([1, 5], [3, 7]);
  return pairs.some(([a, b]) => {
    const ua = occupant(state, add(u.pos, dir(a)));
    const ub = occupant(state, add(u.pos, dir(b)));
    return !!ua && !!ub && ua.side !== u.side && ub.side !== u.side && isMeleeThreat(ua) && isMeleeThreat(ub);
  });
}

/** Can `e` currently hold `mover` in melee contact? */
export function canEngageUnit(state: BattleState, e: UnitState, mover: UnitState): boolean {
  if (!alive(e) || e.side === mover.side || !e.canEngage) return false;
  if (e.massive && !state.config.bossesEngage) return false;
  if (isFlanked(state, e)) return false;
  return true;
}

/** Engagers a mover leaves contact with when stepping from `from` to `to`. */
export function engagersLeft(state: BattleState, mover: UnitState, from: Vec, to: Vec, already: readonly string[]): UnitState[] {
  return state.units.filter(
    (e) =>
      !already.includes(e.id) &&
      canEngageUnit(state, e, mover) &&
      distToUnit(from, e) <= 1 &&
      distToUnit(to, e) > 1,
  );
}

export function skillReady(state: BattleState, u: UnitState, skillId: string): boolean {
  return skillUseReason(state, u, skillId) === null;
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
