// UI/AI queries: reachable tiles with engagement risk, attack previews, timeline projections.

import { SKILLS } from '../content/gear';
import { keepEngagedChance, totalAvoidance, damageAfterDefense } from './formulas';
import { DIRS8, add, eq, key, type Vec } from './geometry';
import { patternDirections } from './patterns';
import { basicAttackHits, ringPenalty, skillTargeting, sweepTiles } from './targeting';
import {
  alive,
  canEngageUnit,
  distToUnit,
  isFlanked,
  occupant,
  skillReady,
  tilesOf,
  unitById,
  walkable,
} from './state';
import type { BattleState, DelayedEffect, SkillDef, UnitState } from './types';


export interface StepRisk {
  index: number; // path index of the tile you step ONTO when leaving contact
  engagerIds: string[];
  chance: number; // chance you are held (and stopped on that tile)
}

export interface Reach {
  path: Vec[];
  cost: number;
  risks: StepRisk[];
}

/** Remaining movement AP for the unit (if it is active) or a full budget. */
export function movementLeft(state: BattleState, u: UnitState): number {
  const a = state.active;
  if (a && a.unitId === u.id) return a.movementLocked ? 0 : state.config.movementBudget - a.moveSpent;
  return state.config.movementBudget;
}

/**
 * Dijkstra over tiles. Cost = tiles × AP per tile, bounded by remaining movement. Units pass through
 * allies but not enemies and can't stop on occupied tiles. Ties prefer fewer engagement checks.
 */
export function reachable(state: BattleState, unitId: string, opts: { budget?: number; from?: Vec } = {}): Map<string, Reach> {
  const u = unitById(state, unitId);
  const out = new Map<string, Reach>();
  const start = opts.from ?? u.pos;
  out.set(key(start), { path: [start], cost: 0, risks: [] });
  if (u.immobile || u.ko) return out;
  const budget = (opts.budget ?? movementLeft(state, u)) + 1e-6;
  const rolled = state.active?.unitId === u.id ? state.active.rolledAgainst : [];
  const dirs = state.config.diagonalMovement ? DIRS8 : DIRS8.filter((_, i) => i % 2 === 0);
  const engagers = state.units.filter((e) => canEngageUnit(state, e, u));
  type Node = { p: Vec; cost: number; risk: number; path: Vec[]; risks: StepRisk[]; rolled: string[] };
  const best = new Map<string, { cost: number; risk: number }>();
  const pass = new Map<string, Node>();
  const frontier: Node[] = [{ p: start, cost: 0, risk: 0, path: [start], risks: [], rolled: [...rolled] }];
  best.set(key(start), { cost: 0, risk: 0 });
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost || a.risk - b.risk);
    const cur = frontier.shift()!;
    const k = key(cur.p);
    if (!pass.has(k)) pass.set(k, cur);
    for (const d of dirs) {
      const np = add(cur.p, d);
      if (!walkable(state, np)) continue;
      const occ = occupant(state, np);
      if (occ && occ.id !== u.id && occ.side !== u.side) continue;
      const nc = cur.cost + u.moveApPerTile;
      if (nc > budget) continue;
      const leaving = engagers.filter((e) => !cur.rolled.includes(e.id) && distToUnit(cur.p, e) <= 1 && distToUnit(np, e) > 1);
      let risks = cur.risks;
      let rolledNext = cur.rolled;
      let nr = cur.risk;
      if (leaving.length) {
        const chances = leaving.map((e) => keepEngagedChance(e.engagement, u.disengagement, state.config));
        const chance = state.config.multiEngager === 'highest' ? Math.max(...chances) : totalAvoidance(chances);
        risks = [...cur.risks, { index: cur.path.length, engagerIds: leaving.map((e) => e.id), chance }];
        rolledNext = [...cur.rolled, ...leaving.map((e) => e.id)];
        nr += 1;
      }
      const nk = key(np);
      const prev = best.get(nk);
      if (prev && (prev.cost < nc - 1e-9 || (Math.abs(prev.cost - nc) < 1e-9 && prev.risk <= nr))) continue;
      best.set(nk, { cost: nc, risk: nr });
      frontier.push({ p: np, cost: nc, risk: nr, path: [...cur.path, np], risks, rolled: rolledNext });
    }
  }
  for (const [k, n] of pass) {
    if (k === key(start)) continue;
    const occ = occupant(state, n.p);
    if (occ && occ.id !== u.id) continue; // can pass through allies, not stop on them
    out.set(k, { path: n.path, cost: n.cost, risks: n.risks });
  }
  return out;
}

/** Probability the whole path completes without being held. */
export function pathSafety(r: Reach): number {
  return r.risks.reduce((acc, s) => acc * (1 - s.chance), 1);
}

// ---------------- Attack previews ----------------

export interface TargetPreview {
  unitId: string;
  name: string;
  hitChance: number;
  avoidChance: number;
  landChance: number;
  expectedDamage: number;
  damageIfLands: number;
  kills: boolean;
  flanked: boolean;
}

export function expectedStrike(state: BattleState, attacker: UnitState, target: UnitState, opts: { hit: number; damage: number; pctPen: number; flatPen: number; ranged: boolean; damageType: 'physical' | 'magic'; noReactions?: boolean }): TargetPreview {
  const cfg = state.config;
  const hitChance = Math.min(0.95, Math.max(0.05, opts.hit));
  const flanked = isFlanked(state, target);
  const mult = flanked ? cfg.flankReactionMult : 1;
  const reactions: number[] = [];
  if (cfg.reactionsEnabled && !target.dazed && !opts.noReactions) {
    if (!target.immobile) reactions.push(target.dodge * mult);
    if (!opts.ranged) reactions.push(target.parry * mult);
    reactions.push(target.block * mult);
  }
  const avoidChance = totalAvoidance(reactions);
  const landChance = hitChance * (1 - avoidChance);
  const defense = opts.damageType === 'physical' ? target.armor : target.mr;
  let dmg = damageAfterDefense(opts.damage, defense, opts.pctPen, opts.flatPen);
  if (flanked) dmg *= 1 + cfg.flankDamageTaken;
  const damageIfLands = Math.max(1, Math.round(dmg));
  const critAdj = 1 + cfg.critChance * (cfg.critMult - 1);
  return {
    unitId: target.id,
    name: target.name,
    hitChance,
    avoidChance,
    landChance,
    expectedDamage: landChance * damageIfLands * critAdj,
    damageIfLands,
    kills: damageIfLands >= target.hp,
    flanked,
  };
}

export interface AttackPreview {
  kind: 'attack' | 'skill';
  anchor: Vec;
  tiles: Vec[];
  apCost: number;
  targets: TargetPreview[];
  area?: Vec[];
  note?: string;
}

export function basicAttackApCost(state: BattleState, u: UnitState): number {
  const moved = state.active?.unitId === u.id && state.active.moved;
  return u.attack.stationaryDiscount && moved ? u.attack.apCost + state.config.bowMoveSurcharge : u.attack.apCost;
}

/** Preview a basic attack aimed at a tile (or null if it can't be aimed there). */
export function previewAttack(state: BattleState, u: UnitState, anchor: Vec, from: Vec = u.pos): AttackPreview | null {
  const moved = { ...u, pos: from };
  const res = basicAttackHits(state, moved, anchor);
  if (!res) return null;
  const targets = res.hits
    .filter((h) => h.unit.side !== u.side || state.config.friendlyFire)
    .map((h) => expectedStrike(state, u, h.unit, { ...u.attack, hit: u.attack.hit - ringPenalty(state, h.ring) }));
  if (targets.length === 0) return null;
  return { kind: 'attack', anchor, tiles: res.tiles, apCost: basicAttackApCost(state, u), targets };
}

/** All anchors where a basic attack from `from` would hit at least one enemy. */
export function attackOptions(state: BattleState, u: UnitState, from: Vec = u.pos): AttackPreview[] {
  const out: AttackPreview[] = [];
  if (u.attack.pattern === 'ranged') {
    for (const e of state.units) {
      if (!alive(e) || e.side === u.side) continue;
      for (const t of tilesOf(e)) {
        const p = previewAttack(state, u, t, from);
        if (p) {
          out.push(p);
          break;
        }
      }
    }
    return out;
  }
  for (const i of patternDirections(u.attack.pattern)) {
    const anchor = add(from, DIRS8[i]!);
    const p = previewAttack(state, u, anchor, from);
    if (p) out.push(p);
  }
  return out;
}

export function skillCost(state: BattleState, u: UnitState, skill: SkillDef): number {
  const moved = state.active?.unitId === u.id && state.active.moved;
  return skill.stationaryDiscount && moved ? skill.apCost + state.config.bowMoveSurcharge : skill.apCost;
}

export function previewSkill(state: BattleState, u: UnitState, skillId: string, anchor: Vec, from: Vec = u.pos): AttackPreview | null {
  const skill = SKILLS[skillId];
  if (!skill) return null;
  const moved = { ...u, pos: from };
  const tg = skillTargeting(state, moved, skill, anchor);
  if (!tg.valid) return null;
  const cost = skillCost(state, u, skill);
  if (skill.kind === 'sigil' || skill.kind === 'sweep') {
    const victims = state.units.filter((x) => alive(x) && tilesOf(x).some((t) => tg.area!.some((a) => eq(a, t))));
    return {
      kind: 'skill', anchor, tiles: tg.area!, area: tg.area!, apCost: cost,
      targets: victims.map((x) => ({ unitId: x.id, name: x.name, hitChance: 1, avoidChance: 0, landChance: 1, expectedDamage: 0, damageIfLands: 0, kills: false, flanked: false })),
      note: `Erupts in ${skill.delay} AP`,
    };
  }
  const t = tg.target!;
  const raw = skill.rawDamage !== undefined ? skill.rawDamage : u.attack.damage;
  const tp = expectedStrike(state, u, t, {
    hit: (skill.rawDamage !== undefined ? 0.9 : u.attack.hit) + (skill.hitBonus ?? 0),
    damage: raw * skill.damageMult,
    pctPen: skill.rawDamage !== undefined ? 0 : u.attack.pctPen + (skill.pctPenBonus ?? 0),
    flatPen: skill.rawDamage !== undefined ? 0 : u.attack.flatPen,
    ranged: skill.kind === 'shot',
    damageType: skill.damageType ?? u.attack.damageType,
  });
  const note = skill.kind === 'shove' ? 'Shoves 1 tile; dazes if blocked' : skill.kind === 'hook' ? 'Drags target next to you' : skill.applies === 'dazed' ? 'Dazes on hit' : undefined;
  return { kind: 'skill', anchor, tiles: [anchor], apCost: cost, targets: [tp], ...(note && { note }) };
}

export function skillOptions(state: BattleState, u: UnitState, skillId: string, from: Vec = u.pos): AttackPreview[] {
  const skill = SKILLS[skillId];
  if (!skill || !skillReady(state, u, skillId)) return [];
  const out: AttackPreview[] = [];
  if (skill.kind === 'sigil' || skill.kind === 'sweep') return out; // free-aim; previewed on hover
  for (const e of state.units) {
    if (!alive(e) || e.side === u.side) continue;
    for (const t of tilesOf(e)) {
      const p = previewSkill(state, u, skillId, t, from);
      if (p) {
        out.push(p);
        break;
      }
    }
  }
  return out;
}

// ---------------- Timeline projections ----------------

export interface TimelineEntry {
  kind: 'unit' | 'effect';
  id: string;
  label: string;
  side: 'player' | 'enemy';
  at: number; // AP from now
  active: boolean;
}

export function timelineEntries(state: BattleState): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const u of state.units) {
    if (!alive(u)) continue;
    const isActive = state.active?.unitId === u.id;
    out.push({ kind: 'unit', id: u.id, label: u.glyph, side: u.side, at: isActive ? 0 : u.nextTurnAt - state.clock, active: isActive });
  }
  for (const e of state.effects) {
    const src = state.units.find((u) => u.id === e.sourceId);
    out.push({ kind: 'effect', id: e.id, label: e.name, side: src?.side ?? 'enemy', at: e.resolveAt - state.clock, active: false });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Where the active unit's next turn would land after spending `extra` more AP. */
export function projectedNextTurn(state: BattleState, extra: number): number {
  const a = state.active;
  if (!a) return 0;
  const spent = a.moveSpent + a.actionSpent + a.reactionSpent + extra;
  return Math.max(spent, state.config.minTurnDelay);
}

export interface Danger {
  effect: DelayedEffect;
  impactIn: number;
  margin: number; // impactIn − projected next turn (>0: you act first)
  safe: boolean;
}

/** Delayed effects that cover `tile` and land before the active unit's projected next turn. */
export function dangerAt(state: BattleState, tile: Vec, projectedDelay: number): Danger[] {
  const out: Danger[] = [];
  for (const e of state.effects) {
    if (!e.tiles.some((t) => eq(t, tile))) continue;
    const impactIn = e.resolveAt - state.clock;
    const margin = impactIn - projectedDelay;
    const safe = margin > 1e-9 || (Math.abs(margin) <= 1e-9 && state.config.tieUnitBeforeEffect);
    out.push({ effect: e, impactIn, margin, safe });
  }
  return out;
}

/** The boss's next sweep, if it acts before the given time: tiles it would cover and when it would land. */
export function bossSweepThreat(state: BattleState): { tiles: Vec[]; bossActsIn: number; landsIn: number } | null {
  const boss = state.units.find((u) => u.ai === 'nephilim' && alive(u));
  if (!boss || !state.boss) return null;
  const tiles = sweepTiles(state);
  const bossActsIn = boss.nextTurnAt - state.clock;
  return { tiles, bossActsIn, landsIn: bossActsIn + state.config.sweepDelay };
}

export function engagedPairs(state: BattleState): [string, string][] {
  const out: [string, string][] = [];
  for (const a of state.units) {
    for (const b of state.units) {
      if (a.id >= b.id || !alive(a) || !alive(b) || a.side === b.side) continue;
      if (distToUnit(a.pos, b) > 1 && distToUnit(b.pos, a) > 1) continue;
      if (canEngageUnit(state, a, b) || canEngageUnit(state, b, a)) out.push([a.id, b.id]);
    }
  }
  return out;
}
