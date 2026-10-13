// The combat engine: build a battle, apply actions, run the AP timeline. Deterministic given seed + actions.

import { ARMOR, SKILLS, WEAPONS } from '../content/gear';
import { DAMAGE_SCALE, UNITS, companionHp } from '../content/units';
import type { RulesConfig } from './config';
import { damageAfterDefense, keepEngagedChance } from './formulas';
import { add, cheb, eq, key, sign, type Vec } from './geometry';
import { basicAttackHits, ringPenalty, skillTargeting } from './targeting';
import { createRng, roll } from './rng';
import {
  alive,
  engagersLeft,
  enemiesOf,
  isFlanked,
  occupant,
  round3,
  skillReady,
  tilesOf,
  unitById,
  walkable,
} from './state';
import type {
  Action,
  AttackProfile,
  BattleState,
  DelayedEffect,
  EncounterDef,
  GameEvent,
  Placement,
  ReactionResult,
  Setup,
  Terrain,
  UnitState,
  UnitTelemetry,
} from './types';
import { reachable } from './queries';

export class RulesError extends Error {}

const emptyTelemetry = (): UnitTelemetry => ({
  turns: 0, moveAp: 0, actionAp: 0, waitAp: 0, damageDealt: 0, damageTaken: 0, attacks: 0, hits: 0, kos: 0,
  escapes: 0, caught: 0, disengageAttempts: 0, disengageFails: 0,
});

const TERRAIN: Record<string, Terrain> = { '.': 'floor', '#': 'wall', o: 'cover', '~': 'pit' };

export function moveApFor(armorClass: UnitState['armorClass'], config: RulesConfig): number {
  switch (armorClass) {
    case 'clothing': return config.moveApClothing;
    case 'light': return config.moveApLight;
    case 'medium': return config.moveApMedium;
    case 'heavy': return config.moveApHeavy;
  }
}

function buildUnit(p: Placement, order: number, level: number, config: RulesConfig, setup?: Setup): UnitState {
  const tpl = UNITS[p.template];
  if (!tpl) throw new Error(`unknown template ${p.template}`);
  const isJubal = tpl.id === 'jubal';
  const armorClass = isJubal && setup ? setup.armor : tpl.armorClass;
  const weaponId = isJubal && setup ? setup.weaponId : tpl.weapon;
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`unknown weapon ${weaponId}`);
  const armor = ARMOR[armorClass];
  const isPlayer = tpl.side === 'player';
  const dmgScale = isPlayer ? (DAMAGE_SCALE[level] ?? 1) * config.playerDamageMult : config.enemyDamageMult;
  const hp = isPlayer ? (companionHp(tpl.id, level) ?? tpl.hp) : Math.round(tpl.hp * config.enemyHpMult);
  const attack: AttackProfile = { ...weapon.attack, damage: round3(weapon.attack.damage * dmgScale) };
  const skillIds = [...new Set([...(weapon.skills ?? []), ...(tpl.skills ?? [])])];
  return {
    id: p.id ?? tpl.id,
    templateId: tpl.id,
    name: p.name ?? tpl.name,
    glyph: tpl.glyph,
    side: tpl.side,
    role: tpl.role,
    level,
    pos: { ...p.at },
    footprint: tpl.footprint ? tpl.footprint.map((o) => ({ ...o })) : [{ x: 0, y: 0 }],
    hp,
    maxHp: hp,
    armor: tpl.armor ?? armor.armor,
    mr: tpl.mr ?? armor.mr,
    armorClass,
    moveApPerTile: tpl.moveApPerTile ?? moveApFor(armorClass, config),
    immobile: !!tpl.immobile,
    massive: !!tpl.massive,
    weaponId,
    attack,
    canEngage: weapon.canEngage,
    engagement: weapon.engagement + (tpl.armor === undefined ? armor.engagement : 0),
    disengagement: weapon.disengagement + (tpl.armor === undefined ? armor.disengagement : 2),
    dodge: (tpl.dodge ?? armor.dodge) + weapon.dodgeBonus,
    parry: weapon.parry,
    block: weapon.block,
    skills: skillIds.filter((id) => SKILLS[id]).map((id) => ({ id, readyAt: 0 })),
    nextTurnAt: p.initiative ?? tpl.initiative ?? 0,
    ko: false,
    dazed: false,
    feared: false,
    ai: tpl.ai ?? null,
    order,
  };
}

export function createBattle(enc: EncounterDef, setup: Setup, config: RulesConfig, seed: number): { state: BattleState; events: GameEvent[] } {
  const tiles: Terrain[] = [];
  for (const row of enc.map.rows) for (const ch of row) tiles.push(TERRAIN[ch] ?? 'floor');
  const placements: Placement[] = [
    { template: 'jubal', at: enc.jubalAt, id: 'jubal' },
    ...enc.allies,
    ...enc.enemies,
  ];
  const units = placements.map((p, i) => {
    const tpl = UNITS[p.template];
    const level = tpl?.side === 'player' ? enc.jubalLevel : (tpl?.level ?? 1);
    return buildUnit(p, i, level, config, setup);
  });
  const state: BattleState = {
    encounterId: enc.id,
    seed,
    rng: createRng(seed),
    config,
    clock: 0,
    map: { width: enc.map.width, height: enc.map.height, tiles },
    units,
    effects: [],
    active: null,
    outcome: 'ongoing',
    seq: 0,
    memory: {},
    telemetry: Object.fromEntries(units.map((u) => [u.id, emptyTelemetry()])),
    boss: enc.boss ?? null,
    log: [],
  };
  const events: GameEvent[] = [];
  advance(state, events);
  state.log.push(...events);
  return { state, events };
}

/** Apply an action for the active unit. Returns a new state and the events it produced. */
export function applyAction(prev: BattleState, action: Action): { state: BattleState; events: GameEvent[] } {
  const state = structuredClone(prev);
  const events: GameEvent[] = [];
  if (state.outcome !== 'ongoing') throw new RulesError('battle is over');
  const active = state.active;
  if (!active || active.unitId !== action.unitId) throw new RulesError(`not ${action.unitId}'s turn`);
  const unit = unitById(state, action.unitId);
  switch (action.type) {
    case 'move':
      doMove(state, unit, action.to, events);
      break;
    case 'attack':
      doAttack(state, unit, action.target, events);
      break;
    case 'skill':
      doSkill(state, unit, action.skillId, action.target, events);
      break;
    case 'endTurn':
      endTurn(state, unit, events);
      break;
  }
  checkOutcome(state, events);
  if (state.active && unitById(state, state.active.unitId).ko) {
    // Active unit died mid-turn (attack of opportunity): its turn ends.
    endTurn(state, unitById(state, state.active.unitId), events);
  }
  if (!state.active) advance(state, events);
  state.log.push(...events);
  return { state, events };
}

// ---------------- Timeline ----------------

export function advance(state: BattleState, events: GameEvent[]): void {
  for (let guard = 0; guard < 10000; guard++) {
    if (state.outcome !== 'ongoing' || state.active) return;
    const cfg = state.config;
    type Cand = { kind: 'unit' | 'effect'; at: number; side: number; order: number; id: string };
    const cands: Cand[] = [
      ...state.units.filter(alive).map((u) => ({ kind: 'unit' as const, at: u.nextTurnAt, side: (u.side === 'player') === cfg.tiePlayerFirst ? 0 : 1, order: u.order, id: u.id })),
      ...state.effects.map((e, i) => ({ kind: 'effect' as const, at: e.resolveAt, side: 0, order: i, id: e.id })),
    ];
    if (cands.length === 0) return;
    const kindRank = (k: Cand['kind']) => ((k === 'unit') === cfg.tieUnitBeforeEffect ? 0 : 1);
    cands.sort((a, b) => a.at - b.at || kindRank(a.kind) - kindRank(b.kind) || a.side - b.side || a.order - b.order);
    const next = cands[0]!;
    state.clock = Math.max(state.clock, round3(next.at));
    if (next.kind === 'effect') {
      const eff = state.effects.find((e) => e.id === next.id)!;
      state.effects = state.effects.filter((e) => e.id !== next.id);
      resolveEffect(state, eff, events);
      checkOutcome(state, events);
      continue;
    }
    const u = unitById(state, next.id);
    state.active = {
      unitId: u.id,
      startedAt: state.clock,
      moveSpent: 0,
      actionSpent: 0,
      reactionSpent: 0,
      acted: false,
      moved: false,
      movementLocked: u.immobile,
      rolledAgainst: [],
      surchargePending: false,
      surchargePaid: false,
    };
    events.push({ t: 'turnStart', unitId: u.id, clock: state.clock });
    return;
  }
  throw new Error('timeline did not converge');
}

export function turnSpent(state: BattleState): number {
  const a = state.active;
  if (!a) return 0;
  return a.moveSpent + a.actionSpent + a.reactionSpent;
}

function endTurn(state: BattleState, unit: UnitState, events: GameEvent[]): void {
  const a = state.active;
  if (!a || a.unitId !== unit.id) return;
  const spent = turnSpent(state);
  const delay = Math.max(spent, state.config.minTurnDelay);
  unit.nextTurnAt = round3(a.startedAt + delay);
  const tel = state.telemetry[unit.id];
  if (tel) {
    tel.turns += 1;
    tel.moveAp += a.moveSpent;
    tel.actionAp += a.actionSpent;
    tel.waitAp += delay - spent;
  }
  if (unit.dazed) {
    unit.dazed = false;
    events.push({ t: 'status', unitId: unit.id, status: 'recovered' });
  }
  unit.feared = false;
  events.push({ t: 'turnEnd', unitId: unit.id, spent, delay, nextTurnAt: unit.nextTurnAt });
  state.active = null;
}

function pushBack(state: BattleState, u: UnitState, ap: number): void {
  if (ap <= 0) return;
  if (state.active?.unitId === u.id) state.active.reactionSpent += ap;
  else u.nextTurnAt = round3(u.nextTurnAt + ap);
}

// ---------------- Movement ----------------

function doMove(state: BattleState, unit: UnitState, to: Vec, events: GameEvent[]): void {
  const a = state.active!;
  if (a.movementLocked) throw new RulesError('movement is locked this turn');
  const reach = reachable(state, unit.id);
  const r = reach.get(key(to));
  if (!r || r.path.length < 2) throw new RulesError('tile not reachable');
  const taken: Vec[] = [unit.pos];
  for (let i = 1; i < r.path.length; i++) {
    const from = unit.pos;
    const step = r.path[i]!;
    const leaving = engagersLeft(state, unit, from, step, a.rolledAgainst);
    let held = false;
    let holder: UnitState | null = null;
    if (leaving.length > 0) {
      a.rolledAgainst.push(...leaving.map((e) => e.id));
      const tel = state.telemetry[unit.id];
      if (tel) tel.disengageAttempts += 1;
      const engagers = state.config.multiEngager === 'highest' ? [leaving.reduce((b, e) => (e.engagement > b.engagement ? e : b))] : leaving;
      for (const e of engagers) {
        const chance = keepEngagedChance(e.engagement, unit.disengagement, state.config);
        const rr = roll(state.rng, chance);
        events.push({ t: 'disengage', unitId: unit.id, engagerId: e.id, chance, roll: rr.roll, held: rr.success });
        if (rr.success) {
          held = true;
          holder = e;
          break;
        }
      }
      if (held && holder) {
        if (tel) tel.disengageFails += 1;
        // Attack of opportunity is chance-based, resolved before the one allowed step.
        const aoo = roll(state.rng, state.config.aooChance);
        if (aoo.success) {
          events.push({ t: 'attack', attackerId: holder.id, name: `${holder.attack.name} (opportunity)`, tiles: [unit.pos], apCost: 0, free: true, targetTile: unit.pos });
          strike(state, holder, unit, holder.attack, 0, events, { free: true });
          if (unit.ko) break;
        } else {
          events.push({ t: 'info', text: `${holder.name} holds ${unit.name} but finds no opening.` });
        }
      }
    }
    if (unit.ko) break;
    // The unit may have been displaced by a dodge; only step if still adjacent to the planned step.
    if (cheb(unit.pos, step) !== 1 || occupant(state, step)) {
      a.movementLocked = true;
      break;
    }
    unit.pos = { ...step };
    taken.push(step);
    a.moveSpent = round3(a.moveSpent + unit.moveApPerTile);
    if (held) {
      a.movementLocked = true;
      break;
    }
  }
  if (taken.length > 1) {
    a.moved = true;
    events.push({ t: 'move', unitId: unit.id, path: taken, cost: round3((taken.length - 1) * unit.moveApPerTile) });
    if (a.surchargePending && !a.surchargePaid) {
      a.actionSpent += state.config.bowMoveSurcharge;
      a.surchargePaid = true;
      a.surchargePending = false;
      events.push({ t: 'info', text: `${unit.name} moved after a stationary shot: +${state.config.bowMoveSurcharge} AP.` });
    }
  }
}

// ---------------- Attacks ----------------

export interface StrikeOpts {
  penalty?: number;
  damageMult?: number;
  pctPenBonus?: number;
  applies?: 'dazed';
  free?: boolean;
  rawDamage?: number;
  damageType?: 'physical' | 'magic';
  noReactions?: boolean;
}

/** Resolve one attack against one target: hit → reactions → penetration → damage → status. */
export function strike(state: BattleState, attacker: UnitState, target: UnitState, profile: AttackProfile, penalty: number, events: GameEvent[], opts: StrikeOpts = {}): GameEvent & { t: 'strike' } {
  const cfg = state.config;
  const hitChance = Math.min(0.95, Math.max(0.05, profile.hit - penalty - (opts.penalty ?? 0)));
  const hr = roll(state.rng, hitChance);
  const ev: GameEvent & { t: 'strike' } = { t: 'strike', attackerId: attacker.id, targetId: target.id, hitChance, hitRoll: hr.roll, hit: hr.success, reactions: [], avoided: null };
  const tel = state.telemetry[attacker.id];
  if (tel) tel.attacks += 1;
  if (!hr.success) {
    events.push(ev);
    return ev;
  }
  const flanked = isFlanked(state, target);
  if (cfg.reactionsEnabled && !target.dazed && !opts.noReactions) {
    const mult = flanked ? cfg.flankReactionMult : 1;
    const options: { kind: ReactionResult['kind']; chance: number; ap: number }[] = [];
    if (!target.immobile) options.push({ kind: 'dodge', chance: target.dodge * mult, ap: cfg.dodgeAp });
    if (!profile.ranged) options.push({ kind: 'parry', chance: target.parry * mult, ap: cfg.parryAp });
    options.push({ kind: 'block', chance: target.block * mult, ap: cfg.blockAp });
    options.sort((x, y) => y.chance - x.chance);
    for (const o of options) {
      if (o.chance <= 0) continue;
      const rr = roll(state.rng, o.chance);
      ev.reactions.push({ kind: o.kind, chance: o.chance, roll: rr.roll, success: rr.success });
      if (rr.success) {
        ev.avoided = o.kind;
        pushBack(state, target, o.ap);
        if (o.kind === 'dodge' && cfg.dodgeDisplaces) {
          const away = { x: sign(target.pos.x - attacker.pos.x), y: sign(target.pos.y - attacker.pos.y) };
          const dest = add(target.pos, away);
          if ((away.x || away.y) && walkable(state, dest) && !occupant(state, dest)) {
            ev.displacedTo = dest;
            target.pos = dest;
          }
        }
        break;
      }
    }
  }
  if (ev.avoided) {
    events.push(ev);
    return ev;
  }
  if (tel) tel.hits += 1;
  const crit = roll(state.rng, cfg.critChance).success;
  const baseRaw = opts.rawDamage !== undefined
    ? opts.rawDamage * (attacker.side === 'player' ? cfg.playerDamageMult : cfg.enemyDamageMult)
    : profile.damage;
  const raw = baseRaw * (opts.damageMult ?? 1) * (crit ? cfg.critMult : 1);
  const dtype = opts.damageType ?? profile.damageType;
  const defense = dtype === 'physical' ? target.armor : target.mr;
  const pct = Math.min(1, profile.pctPen + (opts.pctPenBonus ?? 0));
  const effective = Math.max(0, defense * (1 - pct) - profile.flatPen);
  let dmg = damageAfterDefense(raw, defense, pct, profile.flatPen);
  if (flanked) dmg *= 1 + cfg.flankDamageTaken;
  const amount = Math.max(1, Math.round(dmg));
  Object.assign(ev, { raw: round3(raw), crit, defense, effectiveDefense: round3(effective), flanked, damage: amount });
  dealDamage(state, attacker, target, amount, events);
  ev.hpAfter = target.hp;
  events.push(ev);
  if (target.ko) events.push({ t: 'ko', unitId: target.id });
  if (opts.applies === 'dazed' && !target.ko) applyDazed(state, target, events);
  if (target.ko) onKo(state, target, events);
  return ev;
}

function dealDamage(state: BattleState, source: UnitState | null, target: UnitState, amount: number, _events: GameEvent[]): void {
  target.hp = Math.max(0, target.hp - amount);
  const tt = state.telemetry[target.id];
  if (tt) tt.damageTaken += amount;
  if (source) {
    const st = state.telemetry[source.id];
    if (st) st.damageDealt += amount;
  }
  if (target.hp <= 0 && !target.ko) {
    target.ko = true;
    if (source) {
      const st = state.telemetry[source.id];
      if (st) st.kos += 1;
    }
  }
}

function applyDazed(state: BattleState, target: UnitState, events: GameEvent[]): void {
  const push = round3(state.config.dazedPushback * (target.massive ? state.config.bossDazeMult : 1));
  target.dazed = true;
  pushBack(state, target, push);
  events.push({ t: 'status', unitId: target.id, status: 'dazed', pushback: push });
}

function onKo(state: BattleState, unit: UnitState, events: GameEvent[]): void {
  if (unit.templateId === 'wolf' && state.config.wolfPackFear) {
    for (const w of state.units) {
      if (w.templateId === 'wolf' && alive(w)) {
        w.feared = true;
        events.push({ t: 'status', unitId: w.id, status: 'feared' });
      }
    }
  }
}

function attackCost(state: BattleState, profile: { apCost: number; stationaryDiscount?: boolean }): number {
  const a = state.active!;
  return profile.stationaryDiscount && a.moved ? profile.apCost + state.config.bowMoveSurcharge : profile.apCost;
}

function markStationary(state: BattleState, profile: { stationaryDiscount?: boolean }): void {
  const a = state.active!;
  if (profile.stationaryDiscount && !a.moved) a.surchargePending = true;
  if (profile.stationaryDiscount && a.moved) a.surchargePaid = true;
}

function doAttack(state: BattleState, unit: UnitState, target: Vec, events: GameEvent[]): void {
  const a = state.active!;
  if (a.acted) throw new RulesError('already acted this turn');
  const res = basicAttackHits(state, unit, target);
  if (!res) throw new RulesError('cannot attack there');
  if (res.hits.filter((h) => h.unit.side !== unit.side).length === 0 && !state.config.friendlyFire) throw new RulesError('no enemy in that pattern');
  const cost = attackCost(state, unit.attack);
  markStationary(state, unit.attack);
  a.actionSpent += cost;
  a.acted = true;
  events.push({ t: 'attack', attackerId: unit.id, name: unit.attack.name, tiles: res.tiles, apCost: cost, targetTile: target });
  for (const h of res.hits) {
    if (h.unit.ko) continue;
    strike(state, unit, h.unit, unit.attack, ringPenalty(state, h.ring), events);
  }
}

// ---------------- Skills ----------------

function doSkill(state: BattleState, unit: UnitState, skillId: string, target: Vec, events: GameEvent[]): void {
  const a = state.active!;
  if (a.acted) throw new RulesError('already acted this turn');
  const skill = SKILLS[skillId];
  if (!skill || !unit.skills.some((s) => s.id === skillId)) throw new RulesError('unknown skill');
  if (!skillReady(state, unit, skillId)) throw new RulesError('skill on cooldown');
  const tg = skillTargeting(state, unit, skill, target);
  if (!tg.valid) throw new RulesError(tg.reason ?? 'invalid target');
  const cost = skill.special ? state.config.bossTurnAp : attackCost(state, skill);
  markStationary(state, skill);
  a.actionSpent += cost;
  a.acted = true;
  const slot = unit.skills.find((s) => s.id === skillId)!;
  slot.readyAt = round3(state.clock + skill.cooldown);
  events.push({ t: 'attack', attackerId: unit.id, name: skill.name, tiles: tg.area ?? [target], apCost: cost, targetTile: target });

  const profile: AttackProfile = { ...unit.attack, hit: unit.attack.hit + (skill.hitBonus ?? 0), ranged: skill.kind === 'shot' };
  if (skill.damageType) profile.damageType = skill.damageType;
  const opts: StrikeOpts = { damageMult: skill.damageMult, ...(skill.pctPenBonus !== undefined && { pctPenBonus: skill.pctPenBonus }), ...(skill.applies && { applies: skill.applies }), ...(skill.rawDamage !== undefined && { rawDamage: skill.rawDamage }), ...(skill.damageType && { damageType: skill.damageType }) };
  if (skill.special === 'rockThrow') opts.rawDamage = state.config.rockThrowDamage;
  if (skill.rawDamage !== undefined) { profile.pctPen = 0; profile.flatPen = 0; profile.hit = 0.9 + (skill.hitBonus ?? 0); }

  switch (skill.kind) {
    case 'strike':
    case 'shot':
      strike(state, unit, tg.target!, profile, 0, events, opts);
      break;
    case 'shove': {
      const t = tg.target!;
      const ev = strike(state, unit, t, profile, 0, events, opts);
      if (ev.hit && !ev.avoided && !t.ko) {
        const away = { x: sign(t.pos.x - unit.pos.x), y: sign(t.pos.y - unit.pos.y) };
        const dest = add(t.pos, away);
        if (!t.massive && walkable(state, dest) && !occupant(state, dest)) {
          events.push({ t: 'displace', unitId: t.id, from: t.pos, to: dest, reason: 'push' });
          t.pos = dest;
        } else {
          applyDazed(state, t, events);
        }
      }
      break;
    }
    case 'hook': {
      const t = tg.target!;
      const ev = strike(state, unit, t, profile, 0, events, opts);
      if (ev.hit && !ev.avoided && !t.ko && tg.pullTo && !occupant(state, tg.pullTo)) {
        events.push({ t: 'displace', unitId: t.id, from: t.pos, to: tg.pullTo, reason: 'pull' });
        t.pos = { ...tg.pullTo };
      }
      break;
    }
    case 'sigil': {
      const cfg = state.config;
      const mult = unit.side === 'player' ? cfg.playerDamageMult : cfg.enemyDamageMult;
      const rockfall = skill.special === 'rockfall';
      const dmg = (rockfall ? cfg.rockfallDamage : (skill.rawDamage ?? 0)) * mult;
      const delay = rockfall ? cfg.rockfallDelay : (skill.delay ?? 100);
      castEffect(state, unit, { name: skill.name, tiles: tg.area!, delay, damage: dmg, damageType: skill.damageType ?? 'magic', pctPen: 0 }, events);
      break;
    }
    case 'sweep': {
      const cfg = state.config;
      castEffect(state, unit, { name: skill.name, tiles: tg.area!, delay: cfg.sweepDelay, damage: cfg.sweepDamage * cfg.enemyDamageMult, damageType: 'physical', pctPen: cfg.sweepArmorPen }, events);
      break;
    }
  }
}

// ---------------- Delayed effects ----------------

export function castEffect(
  state: BattleState,
  source: UnitState,
  spec: { name: string; tiles: Vec[]; delay: number; damage: number; damageType: 'physical' | 'magic'; pctPen: number; applies?: 'dazed' },
  events: GameEvent[],
): DelayedEffect {
  state.seq += 1;
  const threatened = state.units.filter((u) => alive(u) && tilesOf(u).some((t) => spec.tiles.some((x) => eq(x, t)))).map((u) => u.id);
  const eff: DelayedEffect = {
    id: `fx${state.seq}`,
    name: spec.name,
    sourceId: source.id,
    tiles: spec.tiles.map((t) => ({ ...t })),
    castAt: state.clock,
    resolveAt: round3(state.clock + spec.delay),
    damage: spec.damage,
    damageType: spec.damageType,
    pctPen: spec.pctPen,
    ...(spec.applies && { applies: spec.applies }),
    threatenedAtCast: threatened,
  };
  state.effects.push(eff);
  events.push({ t: 'effectCast', effect: eff });
  return eff;
}

function resolveEffect(state: BattleState, eff: DelayedEffect, events: GameEvent[]): void {
  const source = state.units.find((u) => u.id === eff.sourceId) ?? null;
  const hits: { unitId: string; damage: number; hpAfter: number }[] = [];
  const victims = state.units.filter((u) => alive(u) && tilesOf(u).some((t) => eff.tiles.some((x) => eq(x, t))));
  for (const u of victims) {
    if (source && u.id === source.id) continue;
    if (source && u.side === source.side && !state.config.delayedHitsAllies) continue;
    const defense = eff.damageType === 'physical' ? u.armor : u.mr;
    const amount = Math.max(1, Math.round(damageAfterDefense(eff.damage, defense, eff.pctPen, 0)));
    dealDamage(state, source, u, amount, events);
    hits.push({ unitId: u.id, damage: amount, hpAfter: u.hp });
    const tel = state.telemetry[u.id];
    if (tel) tel.caught += 1;
  }
  for (const id of eff.threatenedAtCast) {
    if (!hits.some((h) => h.unitId === id)) {
      const u = state.units.find((x) => x.id === id);
      const tel = state.telemetry[id];
      if (u && alive(u) && tel) tel.escapes += 1;
    }
  }
  events.push({ t: 'effectResolve', effectId: eff.id, name: eff.name, tiles: eff.tiles, hits });
  for (const h of hits) {
    const u = unitById(state, h.unitId);
    if (u.ko) {
      events.push({ t: 'ko', unitId: u.id });
      onKo(state, u, events);
    } else if (eff.applies === 'dazed') applyDazed(state, u, events);
  }
}

function checkOutcome(state: BattleState, events: GameEvent[]): void {
  if (state.outcome !== 'ongoing') return;
  const players = state.units.filter((u) => u.side === 'player' && alive(u));
  const enemies = state.units.filter((u) => u.side === 'enemy' && alive(u));
  if (players.length === 0) state.outcome = 'defeat';
  else if (enemies.length === 0) state.outcome = 'victory';
  if (state.outcome !== 'ongoing') {
    state.active = null;
    events.push({ t: 'outcome', outcome: state.outcome });
  }
}

/** Exposed for AI: an enemy list helper that respects KO. */
export const livingEnemies = enemiesOf;

export { basicAttackHits, ringPenalty, skillTargeting };
