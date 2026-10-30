// The combat engine: build a battle, apply actions, run the AP timeline. Deterministic given seed + actions.

import { formatAp } from './describe';
import { attackMode, availableSkills, combatActionReason, enemyTuning, equippedItem, refreshEquipment, reloadReason, reloadSlot, skillUseReason, swapReason, validateSetup, weaponInstance } from './equipment';
import { ARMOR, SKILLS, WEAPONS } from '../content/gear';
import { DAMAGE_SCALE, UNITS, companionHp } from '../content/units';
import type { RulesConfig } from './config';
import { keepEngagedChance } from './formulas';
import { actionApCost, reactionOptions, delayedDamage, effectCanHit, resolvedDamage, resolveSkill, schedulerCompare, turnDelay } from './resolvers';
import { add, cheb, eq, key, line, sign, type Vec } from './geometry';
import { basicAttackHits, dualWieldCandidates, ringPenalty, skillTargeting } from './targeting';
import { createRng, pick, roll } from './rng';
import {
  alive,
  blocksSight,
  engagersLeft,
  enemiesOf,
  isFlanked,
  lineOfSight,
  occupant,
  round3,
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
  reloads: 0, swaps: 0,
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
  const ids: [string, string | null] = isJubal && setup ? setup.weaponIds ?? [setup.weaponId!, null] : [tpl.weapon, tpl.secondaryWeapon ?? null];
  const equippedSlot = isJubal ? setup?.equippedSlot ?? 0 : 0;
  const weaponId = ids[equippedSlot]!;
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`unknown weapon ${weaponId}`);
  const armor = ARMOR[armorClass];
  const isPlayer = tpl.side === 'player';
  const dmgScale = isPlayer ? (DAMAGE_SCALE[level] ?? 1) * config.playerDamageMult : config.enemyDamageMult;
  const hp = isPlayer ? (companionHp(tpl.id, level) ?? tpl.hp) : Math.round(tpl.hp * config.enemyHpMult * enemyTuning(config, tpl.id, 'hp'));
  const attack: AttackProfile = { ...weapon.attack, damage: round3(weapon.attack.damage * dmgScale) };
  const skillIds = isJubal ? [...(tpl.skills ?? [])] : [...new Set([...(tpl.skills ?? []), ...(weapon.id === 'hunting_bow' ? ['aimed_shot'] : weapon.skills)])];
  const owner = p.id ?? tpl.id;
  const u: UnitState = {
    carried: [weaponInstance(owner, 0, ids[0]), ids[1] ? weaponInstance(owner, 1, ids[1]) : null],
    equippedSlot, personalSkills: skillIds.map(id => ({ id, readyAt: 0 })), proficiencies: [], unlockedSpecialFamilies: [], reloadOwedSlot: null, turnOrdinal: 0,
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
  refreshEquipment({ config }, u);
  return u;
}

export function createBattle(enc: EncounterDef, setup: Setup, config: RulesConfig, seed: number): { state: BattleState; events: GameEvent[] } {
  setup = validateSetup(enc, setup, config);
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
  if (new Set(units.flatMap(u => u.carried.filter(item => item !== null).map(item => item.instanceId))).size !== units.flatMap(u => u.carried.filter(item => item !== null)).length) throw new RulesError('duplicate weapon instance identities');
  const state: BattleState = {
    setup: { weaponIds: [...setup.weaponIds!], equippedSlot: setup.equippedSlot ?? 0, armor: setup.armor },
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
      doAttack(state, unit, action.target, events, action.modeId);
      break;
    case 'reload':
      doReload(state, unit, events);
      break;
    case 'swapWeapon':
      doSwap(state, unit, action.slot, events);
      break;
    case 'skill':
      doSkill(state, unit, action.skillId, action.target, events);
      break;
    case 'endTurn':
      endTurn(state, unit, events);
      break;
  }
  if (state.config.autoEndTurn && state.active?.acted && (state.active.movementLocked || state.config.movementBudget - state.active.moveSpent + 1e-6 < unit.moveApPerTile)) endTurn(state, unit, events);
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
    const breakFree = breakFreeAt(state);
    if (breakFree !== null) cands.push({ kind: 'effect', at: breakFree, side: 0, order: 9999, id: '__breakfree' });
    if (cands.length === 0) return;
    cands.sort((a, b) => schedulerCompare(cfg, a, b));
    const next = cands[0]!;
    state.clock = Math.max(state.clock, round3(next.at));
    if (next.id === '__breakfree') {
      state.outcome = 'defeat';
      events.push({ t: 'info', text: 'The Nephilim tears free of the rubble. You were too slow.' }, { t: 'outcome', outcome: 'defeat' });
      return;
    }
    if (next.kind === 'effect') {
      const eff = state.effects.find((e) => e.id === next.id)!;
      state.effects = state.effects.filter((e) => e.id !== next.id);
      resolveEffect(state, eff, events);
      checkOutcome(state, events);
      continue;
    }
    const u = unitById(state, next.id);
    u.turnOrdinal += 1;
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
    if (u.ai === 'nephilim') trackHiding(state, u);
    for (const eff of state.effects) noteEscapeChance(state, u, eff);
    events.push({ t: 'turnStart', unitId: u.id, clock: state.clock });
    return;
  }
  throw new Error('timeline did not converge');
}

/** When the trapped boss tears free (a loss), or null if there's no such clock. */
export function breakFreeAt(state: BattleState): number | null {
  if (state.config.bossBreakFreeAt <= 0) return null;
  return state.units.some((u) => u.ai === 'nephilim' && alive(u)) ? state.config.bossBreakFreeAt : null;
}

/** The Nephilim remembers ranged units that keep hiding from him behind cover. */
function trackHiding(state: BattleState, boss: UnitState): void {
  const eye = state.boss?.eye ?? boss.pos;
  for (const p of state.units) {
    if (!alive(p) || p.side === boss.side || !p.attack.ranged) continue;
    const k = `hidden:${p.id}`;
    const coverKey = `hiddenCover:${p.id}`;
    // Closest blocker to the ranged unit identifies its cover, not merely "out of sight".
    // Use the same Bresenham visibility convention as lineOfSight, and numeric tile IDs so
    // existing serializable AI memory needs no new state shape.
    const blocker = line(p.pos, eye).slice(1, -1).find((t) => blocksSight(state, t));
    const cover = !lineOfSight(state, eye, p.pos) && blocker ? blocker.y * state.map.width + blocker.x : -1;
    state.memory[k] = cover < 0 ? 0 : state.memory[coverKey] === cover ? (state.memory[k] ?? 0) + 1 : 1;
    state.memory[coverKey] = cover;
  }
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
  // Bosses keep a steady rhythm: even a turn spent watching costs a full boss turn.
  const delay = turnDelay(state, unit, spent);
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
  const spentBefore = a.moveSpent;
  let lastFree = unit.pos;
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
        for (const eff of state.effects) if (eff.escapeChances?.[unit.id] === 'couldEscape') eff.escapeChances[unit.id] = 'held';
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
    // Allies can be passed through but not stood on: a unit held mid-path can't stop on an ally's tile.
    const occ = occupant(state, step);
    const lastStep = i === r.path.length - 1;
    const blocked = !!occ && occ.id !== unit.id && (occ.side !== unit.side || lastStep || held);
    if (cheb(unit.pos, step) !== 1 || blocked) {
      a.movementLocked = true;
      break;
    }
    unit.pos = { ...step };
    if (!occ || occ.id === unit.id) lastFree = unit.pos;
    taken.push(step);
    a.moveSpent = round3(a.moveSpent + unit.moveApPerTile);
    if (held) {
      a.movementLocked = true;
      break;
    }
  }
  // Interrupted transit through allies settles on the last unoccupied tile, never on an ally.
  if (state.units.some(x => x.id !== unit.id && alive(x) && tilesOf(x).some(t => eq(t, unit.pos)))) {
    unit.pos = { ...lastFree };
    taken.push(unit.pos);
  }
  if (taken.length > 1) {
    a.moved = true;
    events.push({ t: 'move', unitId: unit.id, path: taken, cost: round3(a.moveSpent - spentBefore) });
    if (a.surchargePending && !a.surchargePaid) {
      a.actionSpent += state.config.bowMoveSurcharge;
      a.surchargePaid = true;
      a.surchargePending = false;
      events.push({ t: 'info', text: `${unit.name} moved after a stationary shot: +${formatAp(state.config.bowMoveSurcharge)} AP.` });
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

function resolveReactions(state: BattleState, origin: Vec, target: UnitState, profile: { ranged?: boolean; allowedReactions?: ReactionResult['kind'][] }) {
  const result: { reactions: ReactionResult[]; avoided: ReactionResult['kind'] | null; displacedTo?: Vec } = { reactions: [], avoided: null };
  for (const o of reactionOptions(state, target, profile)) {
    const rr = roll(state.rng, o.chance);
    result.reactions.push({ kind: o.kind, chance: o.chance, roll: rr.roll, success: rr.success });
    if (!rr.success) continue;
    result.avoided = o.kind;
    pushBack(state, target, o.ap);
    if (o.kind === 'dodge' && state.config.dodgeDisplaces) {
      const away = { x: sign(target.pos.x - origin.x), y: sign(target.pos.y - origin.y) };
      const dest = add(target.pos, away);
      if ((away.x || away.y) && walkable(state, dest) && !occupant(state, dest)) {
        result.displacedTo = dest;
        target.pos = dest;
      }
    }
    break;
  }
  return result;
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
  if (!opts.noReactions) Object.assign(ev, resolveReactions(state, attacker.pos, target, profile));
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
  const amount = resolvedDamage(state, target, raw, dtype, pct, profile.flatPen);
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

function markStationary(state: BattleState, profile: { stationaryDiscount?: boolean }): void {
  const a = state.active!;
  if (profile.stationaryDiscount && !a.moved) a.surchargePending = true;
  if (profile.stationaryDiscount && a.moved) a.surchargePaid = true;
}

function consumeBolt(unit: UnitState): void {
  equippedItem(unit).loaded = false;
  unit.reloadOwedSlot = unit.equippedSlot;
}
function doReload(state: BattleState, unit: UnitState, events: GameEvent[]): void {
  const reason = reloadReason(state, unit);
  if (reason) throw new RulesError(reason);
  const slot = reloadSlot(unit, state.config), item = unit.carried[slot]!, w = WEAPONS[item.defId]!;
  const cost = actionApCost(state, unit, { apCost: w.reloadAp! });
  item.loaded = true;
  if (unit.reloadOwedSlot === slot) unit.reloadOwedSlot = null;
  state.active!.acted = true;
  state.active!.actionSpent += cost;
  state.telemetry[unit.id]!.reloads += 1;
  events.push({ t: 'reload', unitId: unit.id, slot, name: w.name, apCost: cost });
}
function doSwap(state: BattleState, unit: UnitState, slot: 0 | 1, events: GameEvent[]): void {
  const reason = swapReason(state, unit, slot);
  if (reason) throw new RulesError(reason);
  const oldName = WEAPONS[unit.weaponId]!.name;
  const cost = actionApCost(state, unit, { apCost: state.config.weaponSwapAp });
  unit.equippedSlot = slot;
  refreshEquipment(state, unit);
  state.active!.acted = true;
  state.active!.actionSpent += cost;
  state.telemetry[unit.id]!.swaps += 1;
  state.memory[`swap:${unit.id}`] = unit.turnOrdinal;
  events.push({ t: 'swapWeapon', unitId: unit.id, slot, oldName, newName: WEAPONS[unit.weaponId]!.name, apCost: cost });
}
function doAttack(state: BattleState, unit: UnitState, target: Vec, events: GameEvent[], modeId?: string): void {
  const a = state.active!;
  const profile = attackMode(state, unit, modeId);
  if (!profile) throw new RulesError('unknown attack mode');
  const reason = combatActionReason(state, unit, 'attack', profile.ammo === 'bolt');
  if (reason) throw new RulesError(reason);
  const res = basicAttackHits(state, unit, target, modeId);
  if (!res || res.hits.length === 0) throw new RulesError('cannot attack there');
  if (res.hits.filter((h) => h.unit.side !== unit.side).length === 0 && !state.config.friendlyFire) throw new RulesError('no enemy in that pattern');
  const cost = actionApCost(state, unit, profile);
  markStationary(state, profile);
  if (profile.ammo === 'bolt') consumeBolt(unit);
  a.actionSpent += cost;
  a.acted = true;
  events.push({ t: 'attack', attackerId: unit.id, name: profile.name, tiles: res.tiles, apCost: cost, targetTile: target });
  for (const h of res.hits) {
    if (h.unit.ko) continue;
    strike(state, unit, h.unit, profile, ringPenalty(state, h.ring), events);
  }
  if (profile.pattern === 'dualArc') {
    const pool = dualWieldCandidates(state, unit, target);
    if (pool.length) {
      const secondary = pick(state.rng, pool).unit;
      strike(state, unit, secondary, profile, 0, events);
    }
  }
}

// ---------------- Skills ----------------

function doSkill(state: BattleState, unit: UnitState, skillId: string, target: Vec, events: GameEvent[]): void {
  const a = state.active!;
  const reason = skillUseReason(state, unit, skillId);
  if (reason) throw new RulesError(reason);
  const skill = SKILLS[skillId]!;
  const tg = skillTargeting(state, unit, skill, target);
  if (!tg.valid) throw new RulesError(tg.reason ?? 'invalid target');
  const cost = actionApCost(state, unit, skill);
  markStationary(state, skill);
  a.actionSpent += cost;
  a.acted = true;
  const owned = availableSkills(state, unit).find(s => s.id === skillId)!;
  const readyAt = round3(state.clock + skill.cooldown);
  if (owned.instanceId) equippedItem(unit).skillReadyAt[skillId] = readyAt;
  else unit.personalSkills.find(s => s.id === skillId)!.readyAt = readyAt;
  const slot = unit.skills.find(s => s.id === skillId);
  if (slot) slot.readyAt = readyAt;
  if (skill.consumesBolt) consumeBolt(unit);
  events.push({ t: 'attack', attackerId: unit.id, name: skill.name, tiles: tg.area ?? [target], apCost: cost, targetTile: target });

  const { profile, delay } = resolveSkill(state, unit, skill);
  const opts: StrikeOpts = { ...(skill.applies && { applies: skill.applies }) };

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
    case 'sigil':
    case 'sweep': {
      if (skill.special === 'rockfall') for (const u of state.units) if (tg.area!.some((t) => eq(t, u.pos))) state.memory[`hidden:${u.id}`] = 0;
      castEffect(state, unit, { name: skill.name, tiles: tg.area!, delay, damage: profile.damage, damageType: profile.damageType, pctPen: profile.pctPen, allowedReactions: profile.allowedReactions ?? [], ...(skill.applies && { applies: skill.applies }) }, events);
      break;
    }
  }
}

// ---------------- Delayed effects ----------------

export function castEffect(
  state: BattleState,
  source: UnitState,
  spec: { name: string; tiles: Vec[]; delay: number; damage: number; damageType: 'physical' | 'magic'; pctPen: number; applies?: 'dazed'; allowedReactions?: ReactionResult['kind'][] },
  events: GameEvent[],
): DelayedEffect {
  state.seq += 1;
  const threatened = state.units.filter((u) => effectCanHit(state, { sourceId: source.id }, u) && tilesOf(u).some((t) => spec.tiles.some((x) => eq(x, t)))).map((u) => u.id);
  const eff: DelayedEffect = {
    id: `fx${state.seq}`,
    name: spec.name,
    sourceId: source.id,
    origin: { ...source.pos },
    allowedReactions: [...(spec.allowedReactions ?? [])],
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
  // The unit holding the turn (usually the caster) may still step out before it ends.
  if (state.active) noteEscapeChance(state, unitById(state, state.active.unitId), eff);
  events.push({ t: 'effectCast', effect: eff });
  return eff;
}

/** Record whether `u`, holding the turn, could end it clear of `eff`; the latest turn before impact wins. */
function noteEscapeChance(state: BattleState, u: UnitState, eff: DelayedEffect): void {
  if (!effectCanHit(state, eff, u)) return;
  const inside = (pos: Vec) => tilesOf({ ...u, pos }).some((t) => eff.tiles.some((x) => eq(x, t)));
  const clear = !inside(u.pos) || [...reachable(state, u.id).values()].some((r) => !inside(r.path.at(-1)!));
  (eff.escapeChances ??= {})[u.id] = clear ? 'couldEscape' : 'trapped';
}

function resolveEffect(state: BattleState, eff: DelayedEffect, events: GameEvent[]): void {
  const source = state.units.find((u) => u.id === eff.sourceId) ?? null;
  const hits: Extract<GameEvent, { t: 'effectResolve' }>['hits'] = [];
  const victims = state.units.filter((u) => alive(u) && tilesOf(u).some((t) => eff.tiles.some((x) => eq(x, t))));
  for (const u of victims) {
    if (!effectCanHit(state, eff, u)) continue;
    const from = { ...u.pos };
    const reaction = resolveReactions(state, eff.origin ?? source?.pos ?? u.pos, u, { allowedReactions: eff.allowedReactions ?? [] });
    if (reaction.displacedTo) events.push({ t: 'displace', unitId: u.id, from, to: reaction.displacedTo, reason: 'dodge' });
    const amount = reaction.avoided ? 0 : delayedDamage(state, eff, u);
    if (!reaction.avoided) dealDamage(state, source, u, amount, events);
    const chance = eff.escapeChances?.[u.id];
    const reason = chance === undefined ? 'late' : chance === 'couldEscape' ? 'stayed' : chance;
    hits.push({ unitId: u.id, damage: amount, hpAfter: u.hp, ...reaction, ...(!reaction.avoided && { caught: { reason, nextTurnAt: u.nextTurnAt } }) });
    const tel = state.telemetry[u.id];
    if (tel && !reaction.avoided) tel.caught += 1;
  }
  const escaped = eff.threatenedAtCast.filter((id) => {
    const u = state.units.find((x) => x.id === id);
    return !!u && alive(u) && effectCanHit(state, eff, u) && !hits.some((h) => h.unitId === id);
  });
  for (const id of escaped) {
    const tel = state.telemetry[id];
    if (tel) tel.escapes += 1;
  }
  events.push({ t: 'effectResolve', effectId: eff.id, name: eff.name, tiles: eff.tiles, at: eff.resolveAt, hits, escaped });
  for (const h of hits) {
    const u = unitById(state, h.unitId);
    if (u.ko) {
      events.push({ t: 'ko', unitId: u.id });
      onKo(state, u, events);
    } else if (!h.avoided && eff.applies === 'dazed') applyDazed(state, u, events);
  }
}

function checkOutcome(state: BattleState, events: GameEvent[]): void {
  if (state.outcome !== 'ongoing') return;
  const players = state.units.filter((u) => u.side === 'player' && alive(u));
  const enemies = state.units.filter((u) => u.side === 'enemy' && alive(u));
  if (players.length === 0) state.outcome = 'defeat';
  else if (enemies.length === 0) state.outcome = 'victory';
  if (state.outcome !== 'ongoing') {
    if (state.active) endTurn(state, unitById(state, state.active.unitId), events);
    events.push({ t: 'outcome', outcome: state.outcome });
  }
}

/** Exposed for AI: an enemy list helper that respects KO. */
export const livingEnemies = enemiesOf;

export { basicAttackHits, ringPenalty, skillTargeting };
