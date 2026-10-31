// Targeting: which units a basic attack or skill aimed at a tile would affect. Shared by engine, previews, AI.

import { attackMode } from './equipment';
import { add, cheb, dir, dirIndexOf, DIRS8, type Vec } from './geometry';
import { aimDirection, patternTiles } from './patterns';
import { alive, distToUnit, enemiesOf, lineOfSight, occupant, terrainAt, walkable } from './state';
import type { BattleState, SkillDef, UnitState } from './types';

export interface PatternHit {
  unit: UnitState;
  ring: 0 | 1 | 2;
  tile: Vec;
}

/** Units a basic attack from `unit` (at its current pos) aimed at `target` would hit, or null if not aimable. */
export function dualWieldCandidates(state: BattleState, unit: UnitState, target: Vec): { unit: UnitState; probability: number }[] {
  const i = aimDirection('dualArc', unit.pos, target);
  if (i === null) return [];
  const pool = new Map<string, UnitState>();
  for (const pt of patternTiles('dualArc', unit.pos, i)) {
    const u = occupant(state, pt.tile);
    if (u && !u.ko && u.side !== unit.side) pool.set(u.id, u);
  }
  const units = [...pool.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return units.map(u => ({ unit: u, probability: 1 / units.length }));
}
export function colossalRingTiles(unit: UnitState): Vec[] { return patternTiles('ring8', unit.pos, 0).map(p => p.tile); }

export function basicAttackHits(state: BattleState, unit: UnitState, target: Vec, modeId?: string): { tiles: Vec[]; hits: PatternHit[]; candidates?: { unit: UnitState; probability: number }[] } | null {
  const p = attackMode(state, unit, modeId);
  if (!p) return null;
  if (p.pattern === 'ranged') {
    const t = occupant(state, target);
    if (!t || t.side === unit.side) return null;
    const d = distToUnit(unit.pos, t);
    const [lo, hi] = p.range ?? [1, 1];
    if (d < lo || d > hi) return null;
    if (!lineOfSight(state, unit.pos, target)) return null;
    return { tiles: [target], hits: [{ unit: t, ring: 0, tile: target }] };
  }
  const i = aimDirection(p.pattern, unit.pos, target);
  if (i === null) return null;
  let tiles = patternTiles(p.pattern, unit.pos, i);
  if (p.pattern === 'dualArc') {
    const primary = occupant(state, target);
    if (!primary || primary.side === unit.side) return null;
    return { tiles: tiles.map(t => t.tile), hits: [{ unit: primary, ring: 0, tile: target }], candidates: dualWieldCandidates(state, unit, target) };
  }
  if (p.pattern === 'line2') {
    // A wall stops the thrust.
    if (terrainAt(state, tiles[0]!.tile) === 'wall') return null;
    if (terrainAt(state, tiles[1]!.tile) === 'wall') tiles = [tiles[0]!];
  }
  const seen = new Map<string, PatternHit>();
  for (const pt of tiles) {
    const occ = occupant(state, pt.tile);
    if (!occ || occ.id === unit.id) continue;
    if (occ.side === unit.side && !state.config.friendlyFire) continue;
    const prev = seen.get(occ.id);
    if (!prev || pt.ring < prev.ring) seen.set(occ.id, { unit: occ, ring: pt.ring, tile: pt.tile });
  }
  return { tiles: tiles.map((t) => t.tile), hits: [...seen.values()] };
}

export function ringPenalty(state: BattleState, ring: 0 | 1 | 2): number {
  return ring === 1 ? state.config.twoHandedNearPenalty : ring === 2 ? state.config.twoHandedFarPenalty : 0;
}

/** The Nephilim's sweep zone: `sweepDepth` rows in front of him across the arena. */
export function sweepTiles(state: BattleState): Vec[] {
  if (!state.boss) return [];
  const { sweepRowStart, sweepCols } = state.boss;
  const out: Vec[] = [];
  for (let y = sweepRowStart; y < sweepRowStart + state.config.sweepDepth; y++)
    for (let x = sweepCols[0]; x <= sweepCols[1]; x++) if (walkable(state, { x, y })) out.push({ x, y });
  return out;
}

/** Open tiles around a summoner, nearest the enemy first (ties in DIRS8 order). Single-tile casters only. */
export function summonTiles(state: BattleState, unit: UnitState): Vec[] {
  const foes = enemiesOf(state, unit);
  return DIRS8.map((d) => add(unit.pos, d))
    .filter((p) => walkable(state, p) && !occupant(state, p))
    .map((p) => ({ p, d: foes.length ? Math.min(...foes.map((f) => distToUnit(p, f))) : 0 }))
    .sort((a, b) => a.d - b.d) // stable sort: ties keep DIRS8 order
    .map((x) => x.p);
}

export interface SkillTargeting {
  valid: boolean;
  reason?: string;
  target?: UnitState;
  area?: Vec[];
  pullTo?: Vec;
}

export function skillTargeting(state: BattleState, unit: UnitState, skill: SkillDef, target: Vec): SkillTargeting {
  const t = occupant(state, target);
  switch (skill.kind) {
    case 'strike':
    case 'shove': {
      if (!t || t.side === unit.side) return { valid: false, reason: 'needs an adjacent enemy' };
      if (distToUnit(unit.pos, t) !== 1) return { valid: false, reason: 'not adjacent' };
      return { valid: true, target: t };
    }
    case 'hook': {
      if (!t || t.side === unit.side) return { valid: false, reason: 'needs an enemy' };
      if (t.footprint.length > 1 || t.massive) return { valid: false, reason: 'too massive to drag' };
      const i = dirIndexOf(unit.pos, t.pos);
      if (i < 0 || cheb(unit.pos, t.pos) !== 2) return { valid: false, reason: 'must be exactly 2 tiles away in a straight line' };
      const mid = add(unit.pos, dir(i));
      if (!walkable(state, mid) || occupant(state, mid)) return { valid: false, reason: 'the space between is blocked' };
      return { valid: true, target: t, pullTo: mid };
    }
    case 'shot': {
      if (!t || t.side === unit.side) return { valid: false, reason: 'needs an enemy' };
      const d = distToUnit(unit.pos, t);
      const [lo, hi] = skill.range ?? [2, 6];
      if (d < lo || d > hi) return { valid: false, reason: `range ${lo}–${hi}` };
      if (skill.needsLos && !lineOfSight(state, unit.pos, target)) return { valid: false, reason: 'no line of sight' };
      return { valid: true, target: t };
    }
    case 'sweep':
      return { valid: true, area: sweepTiles(state) };
    case 'sigil': {
      const [, hi] = skill.range ?? [0, 6];
      if (cheb(unit.pos, target) > hi) return { valid: false, reason: `range ${hi}` };
      if (terrainAt(state, target) !== 'floor') return { valid: false, reason: 'must target open ground' };
      const r = skill.radius ?? 1;
      const area: Vec[] = [];
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const p = { x: target.x + dx, y: target.y + dy };
          if (terrainAt(state, p) === 'floor') area.push(p);
        }
      return { valid: true, area };
    }
    case 'summon': {
      const spec = skill.summon!;
      const living = state.units.filter((x) => alive(x) && x.side === unit.side && (x.templateId === spec.template || x.templateId === spec.variant?.template)).length;
      const room = Math.min(spec.count, state.config.broodMaxRats - living);
      if (room <= 0) return { valid: false, reason: 'the brood is at full strength' };
      const area = summonTiles(state, unit).slice(0, room);
      if (area.length === 0) return { valid: false, reason: 'no open tile to summon onto' };
      return { valid: true, area };
    }
  }
}
