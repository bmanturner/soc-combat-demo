// UI/AI queries: reachable tiles with engagement risk, attack previews, timeline projections.

import { attackMode, attackModes, combatActionReason, equippedItem, equippedWeapon, reloadReason, reloadSlot, skillUseReason, swapReason } from './equipment';
import { SKILLS, WEAPONS } from '../content/gear';
export { availableWeapons, availableSkills, attackModes, equippedWeapon, equippedItem, effectiveStats, weaponLockReason, normalizeSetup } from './equipment';
export { dualWieldCandidates, colossalRingTiles } from './targeting';
import { keepEngagedChance, totalAvoidance } from './formulas';
import { actionApCost, allowedReactions, delayedDamage, effectCanHit, hypotheticalBoard, resolvedDamage, resolveSkill, schedulerCompare, turnDelay, unitActsBefore, unitSchedule } from './resolvers';
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

export function expectedStrike(state: BattleState, attacker: UnitState, target: UnitState, opts: { hit: number; damage: number; pctPen: number; flatPen: number; ranged: boolean; damageType: 'physical' | 'magic'; noReactions?: boolean; allowedReactions?: ('dodge' | 'parry' | 'block')[] }): TargetPreview {
  const cfg = state.config;
  const hitChance = Math.min(0.95, Math.max(0.05, opts.hit));
  const flanked = isFlanked(state, target);
  const mult = flanked ? cfg.flankReactionMult : 1;
  const reactions: number[] = [];
  if (cfg.reactionsEnabled && !target.dazed && !opts.noReactions) {
    const allowed = allowedReactions(opts);
    if (!target.immobile && allowed.includes('dodge')) reactions.push(target.dodge * mult);
    if (allowed.includes('parry')) reactions.push(target.parry * mult);
    if (allowed.includes('block')) reactions.push(target.block * mult);
  }
  const avoidChance = totalAvoidance(reactions);
  const landChance = hitChance * (1 - avoidChance);
  const damageIfLands = resolvedDamage(state, target, opts.damage, opts.damageType, opts.pctPen, opts.flatPen);
  const criticalDamage = resolvedDamage(state, target, opts.damage * cfg.critMult, opts.damageType, opts.pctPen, opts.flatPen);
  return {
    unitId: target.id,
    name: target.name,
    hitChance,
    avoidChance,
    landChance,
    expectedDamage: landChance * (damageIfLands * (1 - cfg.critChance) + criticalDamage * cfg.critChance),
    damageIfLands,
    kills: damageIfLands >= target.hp,
    flanked,
  };
}

export interface AttackPreview {
  modeId?: string;
  instanceId?: string;
  cycleAp?: number;
  candidates?: (TargetPreview & { probability: number })[];
  kind: 'attack' | 'skill';
  anchor: Vec;
  tiles: Vec[];
  apCost: number;
  targets: TargetPreview[];
  area?: Vec[];
  note?: string;
}

export function basicAttackApCost(state: BattleState, u: UnitState, modeId?: string): number {
  return actionApCost(state, u, attackMode(state, u, modeId) ?? u.attack);
}

/** Preview a mode from a coherent hypothetical board, without RNG or mutation. Candidates are conditional, never guaranteed hits. */
export function previewAttack(state: BattleState, u: UnitState, anchor: Vec, from: Vec = u.pos, modeId?: string): AttackPreview | null {
  const hypotheticalMove = !eq(u.pos, from);
  state = hypotheticalBoard(state, u, from);
  u = unitById(state, u.id);
  const profile = attackMode(state, u, modeId);
  if (!profile || combatActionReason(state, u, 'attack', profile.ammo === 'bolt')) return null;
  const res = basicAttackHits(state, u, anchor, modeId);
  if (!res) return null;
  const targets = res.hits.map(h => expectedStrike(state, u, h.unit, { ...profile, hit: profile.hit - ringPenalty(state, h.ring) }));
  if (targets.length === 0) return null;
  const cost = actionApCost(state, u, profile, hypotheticalMove);
  return {
    kind: 'attack', modeId: profile.id, instanceId: equippedItem(u).instanceId, anchor, tiles: res.tiles, apCost: cost, targets,
    cycleAp: cost + (profile.ammo === 'bolt' ? equippedWeapon(state, u).reloadAp! : 0),
    ...(res.candidates ? { candidates: res.candidates.map(c => ({ ...expectedStrike(state, u, c.unit, profile), probability: c.probability })), note: 'One random secondary. Probabilities conditional on the current pool surviving unchanged; pool is recomputed after the primary (including death/dodge).' } : {}),
  };
}

/** All legal (mode, anchor) combinations, for UI and AI. */
export function attackOptions(state: BattleState, u: UnitState, from: Vec = u.pos): AttackPreview[] {
  const out: AttackPreview[] = [];
  for (const mode of attackModes(state, u)) {
    const anchors = mode.pattern === 'ranged' ? state.units.filter(e => alive(e) && e.side !== u.side).flatMap(tilesOf)
      : mode.pattern === 'ring8' ? [from] : patternDirections(mode.pattern).map(i => add(from, DIRS8[i]!));
    const seen = new Set<string>();
    for (const anchor of anchors) {
      const p = previewAttack(state, u, anchor, from, mode.id);
      if (!p) continue;
      const k = mode.pattern === 'ranged' ? p.targets[0]!.unitId : key(anchor);
      if (!seen.has(k)) { out.push(p); seen.add(k); }
    }
  }
  return out;
}

export interface EquipmentPreview { valid: boolean; reason: string | null; apCost: number; nextTurnIn: number; slot: 0 | 1; instanceId: string | null }
export function previewReload(state: BattleState, u: UnitState): EquipmentPreview {
  const slot = reloadSlot(u, state.config), item = u.carried[slot];
  const reason = reloadReason(state, u);
  const apCost = actionApCost(state, u, { apCost: item ? WEAPONS[item.defId]!.reloadAp ?? 0 : 0 });
  return { valid: !reason, reason, apCost, nextTurnIn: projectedNextTurn(state, apCost), slot, instanceId: item?.instanceId ?? null };
}
export function previewSwap(state: BattleState, u: UnitState, slot: 0 | 1): EquipmentPreview {
  const reason = swapReason(state, u, slot), apCost = actionApCost(state, u, { apCost: state.config.weaponSwapAp });
  return { valid: !reason, reason, apCost, nextTurnIn: projectedNextTurn(state, apCost), slot, instanceId: u.carried[slot]?.instanceId ?? null };
}

export function skillCost(state: BattleState, u: UnitState, skill: SkillDef): number {
  return actionApCost(state, u, skill);
}

export function previewSkill(state: BattleState, u: UnitState, skillId: string, anchor: Vec, from: Vec = u.pos): AttackPreview | null {
  const skill = SKILLS[skillId];
  if (!skill || skillUseReason(state, u, skillId)) return null;
  const hypotheticalMove = !eq(u.pos, from);
  state = hypotheticalBoard(state, u, from);
  u = unitById(state, u.id);
  const moved = u;
  const tg = skillTargeting(state, moved, skill, anchor);
  if (!tg.valid) return null;
  const cost = actionApCost(state, u, skill, hypotheticalMove);
  const { profile, delay } = resolveSkill(state, u, skill);
  if (skill.kind === 'sigil' || skill.kind === 'sweep') {
    const victims = state.units.filter((x) => effectCanHit(state, { sourceId: u.id }, x) && tilesOf(x).some((t) => tg.area!.some((a) => eq(a, t))));
    return {
      kind: 'skill', anchor, tiles: tg.area!, area: tg.area!, apCost: cost,
      targets: victims.map((x) => {
        const damage = delayedDamage(state, profile, x);
        return { unitId: x.id, name: x.name, hitChance: 1, avoidChance: 0, landChance: 1, expectedDamage: damage, damageIfLands: damage, kills: damage >= x.hp, flanked: isFlanked(state, x) };
      }),
      note: `Erupts in ${delay} AP`,
    };
  }
  const t = tg.target!;
  const tp = expectedStrike(state, u, t, profile);
  const note = skill.kind === 'shove' ? 'Shoves 1 tile; dazes if blocked' : skill.kind === 'hook' ? 'Drags target next to you' : skill.applies === 'dazed' ? 'Dazes on hit' : undefined;
  return { kind: 'skill', instanceId: equippedItem(u).instanceId, modeId: skill.modeId ?? 'basic', cycleAp: cost + (skill.consumesBolt ? equippedWeapon(state, u).reloadAp! : 0), anchor, tiles: [anchor], apCost: cost, targets: [tp], ...(note && { note }) };
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
  const scheduled = (e: TimelineEntry) => e.kind === 'unit' ? unitSchedule(state, unitById(state, e.id), e.at) : { kind: 'effect' as const, at: e.at, side: 0, order: state.effects.findIndex(x => x.id === e.id) };
  return out.sort((a, b) => Number(b.active) - Number(a.active) || schedulerCompare(state.config, scheduled(a), scheduled(b)));
}

/** Where the active unit's next turn would land after spending `extra` more AP. */
export function projectedNextTurn(state: BattleState, extra: number): number {
  const a = state.active;
  if (!a) return 0;
  const spent = a.moveSpent + a.actionSpent + a.reactionSpent + extra;
  return a.startedAt - state.clock + turnDelay(state, unitById(state, a.unitId), spent);
}

export interface Danger {
  effect: DelayedEffect;
  impactIn: number;
  margin: number; // impactIn − projected next turn (>0: you act first)
  safe: boolean;
  outlook: EscapeOutlook;
}

export interface EscapeOutlook {
  eligible: boolean;
  inside: boolean;
  actsBefore: boolean;
  reachableSafe: boolean;
  disengageRisk: number;
  canEscape: boolean;
}
/** Movement is instantaneous within a turn; never subtract walking AP from impact time.
 * This predicts the next turn on the current board, not intervening AI moves or RNG.
 */
export function escapeOutlook(state: BattleState, u: UnitState, effect: Pick<DelayedEffect, 'sourceId' | 'resolveAt' | 'tiles'>, opts: { from?: Vec; nextAt?: number } = {}): EscapeOutlook {
  const board = hypotheticalBoard(state, u, opts.from ?? u.pos);
  const moved = unitById(board, u.id);
  const eligible = effectCanHit(board, effect, moved);
  const inside = tilesOf(moved).some(t => effect.tiles.some(x => eq(x, t)));
  const nextAt = opts.nextAt ?? (state.active?.unitId === u.id ? state.clock + projectedNextTurn(state, 0) : u.nextTurnAt);
  const actsBefore = unitActsBefore(state, u, nextAt, { kind: 'effect', at: effect.resolveAt });
  // Next turn restores the full movement budget and disengage checks.
  const future = { ...board, active: null };
  let bestSafety = -1;
  for (const r of reachable(future, u.id).values()) {
    const pos = r.path.at(-1)!;
    if (tilesOf({ ...moved, pos }).some(t => effect.tiles.some(x => eq(x, t)))) continue;
    bestSafety = Math.max(bestSafety, pathSafety(r));
  }
  const reachableSafe = bestSafety >= 0;
  return { eligible, inside, actsBefore, reachableSafe, disengageRisk: reachableSafe ? 1 - bestSafety : 0, canEscape: !eligible || !inside || (actsBefore && reachableSafe) };
}

/** Eligible delayed effects covering the projected position, with geometric escape outlook. */
export function dangerAt(state: BattleState, tile: Vec, projectedDelay: number): Danger[] {
  const u = state.active ? unitById(state, state.active.unitId) : null;
  if (!u) return [];
  const out: Danger[] = [];
  for (const e of state.effects) {
    if (!effectCanHit(state, e, u)) continue;
    const moved = { ...u, pos: tile };
    if (!tilesOf(moved).some(t => e.tiles.some(x => eq(x, t)))) continue;
    const impactIn = e.resolveAt - state.clock;
    const outlook = escapeOutlook(state, u, e, { from: tile, nextAt: state.clock + projectedDelay });
    out.push({ effect: e, impactIn, margin: impactIn - projectedDelay, safe: outlook.canEscape, outlook });
  }
  return out;
}

/** The boss's next sweep, if it acts before the given time: tiles it would cover and when it would land. */
export function bossSweepThreat(state: BattleState): { bossId: string; tiles: Vec[]; bossActsIn: number; landsIn: number } | null {
  const boss = state.units.find((u) => u.ai === 'nephilim' && alive(u));
  if (!boss || !state.boss) return null;
  const tiles = sweepTiles(state);
  const bossActsIn = boss.nextTurnAt - state.clock;
  return { bossId: boss.id, tiles, bossActsIn, landsIn: bossActsIn + resolveSkill(state, boss, SKILLS.nephilim_sweep!).delay };
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
