// Core data types for the combat rules. Content (weapons, units, encounters) is plain data typed here.

import type { RulesConfig } from './config';
import type { Vec } from './geometry';
import type { Rng } from './rng';

export type Side = 'player' | 'enemy';
export type ArmorClass = 'clothing' | 'light' | 'medium' | 'heavy';
export type DamageType = 'physical' | 'magic';
export type Terrain = 'floor' | 'wall' | 'cover' | 'pit';

/**
 * Attack shapes from the weapon notes.
 * - cardinal: one tile N/E/S/W (daggers, rats)
 * - pairCw: target adjacent tile + the next tile clockwise (one-handed + shield)
 * - line2: two tiles in a straight 8-way line (polearm)
 * - arc5: target adjacent tile + two tiles to each side (two-handed)
 * - adjacent: any one adjacent tile (bites, staff, javelin melee)
 * - ranged: single target within range with line of sight (bow, thrown, bolts)
 */
export type PatternKind = 'cardinal' | 'pairCw' | 'line2' | 'arc5' | 'adjacent' | 'ranged';

export interface AttackProfile {
  name: string;
  pattern: PatternKind;
  apCost: number;
  /** Bow rule: stationary price. If the unit moves this turn (before or after), it pays apCost + config.bowMoveSurcharge. */
  stationaryDiscount?: boolean;
  range?: [number, number];
  damage: number;
  hit: number;
  damageType: DamageType;
  pctPen: number;
  flatPen: number;
  /** Ranged attacks can't be parried. */
  ranged: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  family: 'daggers' | 'shield' | 'polearm' | 'two_handed' | 'bow' | 'natural' | 'staff';
  attack: AttackProfile;
  canEngage: boolean;
  engagement: number;
  disengagement: number;
  parry: number;
  block: number;
  dodgeBonus: number;
  skills: string[];
  blurb: string;
}

export interface ArmorDef {
  id: ArmorClass;
  name: string;
  armor: number;
  mr: number;
  dodge: number;
  engagement: number;
  disengagement: number;
  blurb: string;
}

export type SkillKind =
  | 'strike' // adjacent single target, damage multiplier, optional status
  | 'shove' // adjacent single target, pushes 1 tile away
  | 'hook' // straight-line target at range 2, pulls adjacent
  | 'shot' // ranged single target
  | 'sigil' // delayed area effect
  | 'sweep'; // boss: delayed effect over the encounter's sweep zone

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  apCost: number;
  cooldown: number;
  range?: [number, number];
  needsLos?: boolean;
  damageMult: number;
  hitBonus?: number;
  pctPenBonus?: number;
  damageType?: DamageType;
  rawDamage?: number; // for sigils / spells that don't scale off a weapon
  applies?: 'dazed';
  stationaryDiscount?: boolean;
  delay?: number;
  radius?: number; // sigil: Chebyshev radius of the area
  /** Boss abilities whose numbers come from the rules config (so they're tunable live). */
  special?: 'sweep' | 'rockThrow' | 'rockfall';
  description: string;
  status: 'source' | 'demo';
}

export type AiKind = 'swarm' | 'charger' | 'guardian' | 'caster' | 'nephilim';

export interface UnitTemplate {
  id: string;
  name: string;
  glyph: string;
  side: Side;
  role: string;
  hp: number;
  armorClass: ArmorClass;
  /** Overrides armor table values for monsters. */
  armor?: number;
  mr?: number;
  moveApPerTile?: number;
  dodge?: number;
  weapon: string;
  skills?: string[];
  ai?: AiKind;
  footprint?: Vec[]; // relative offsets; default single tile
  immobile?: boolean;
  massive?: boolean; // bosses: half daze, no displacement
  initiative?: number; // starting AP on the timeline
  level?: number;
}

export interface UnitState {
  id: string;
  templateId: string;
  name: string;
  glyph: string;
  side: Side;
  role: string;
  level: number;
  pos: Vec;
  footprint: Vec[];
  hp: number;
  maxHp: number;
  armor: number;
  mr: number;
  armorClass: ArmorClass;
  moveApPerTile: number;
  immobile: boolean;
  massive: boolean;
  weaponId: string;
  attack: AttackProfile;
  canEngage: boolean;
  engagement: number;
  disengagement: number;
  dodge: number;
  parry: number;
  block: number;
  skills: { id: string; readyAt: number }[];
  nextTurnAt: number;
  ko: boolean;
  dazed: boolean;
  feared: boolean;
  ai: AiKind | null;
  order: number;
}

export interface DelayedEffect {
  id: string;
  name: string;
  sourceId: string;
  tiles: Vec[];
  castAt: number;
  resolveAt: number;
  damage: number;
  damageType: DamageType;
  pctPen: number;
  applies?: 'dazed';
  /** Units inside the area when it was cast (telemetry: escapes). */
  threatenedAtCast: string[];
}

export interface ActiveTurn {
  unitId: string;
  startedAt: number;
  moveSpent: number;
  actionSpent: number;
  reactionSpent: number;
  acted: boolean;
  moved: boolean;
  movementLocked: boolean;
  rolledAgainst: string[];
  surchargePending: boolean;
  surchargePaid: boolean;
}

export interface MapDef {
  width: number;
  height: number;
  /** Row strings. '.' floor, '#' wall, 'o' cover, '~' pit. */
  rows: string[];
}

export interface Placement {
  template: string;
  at: Vec;
  id?: string;
  name?: string;
  initiative?: number;
}

export interface EncounterDef {
  id: string;
  name: string;
  subtitle: string;
  lesson: string;
  story: string;
  map: MapDef;
  floorTone: string;
  /** Jubal's level for this fight; he gets the setup-screen weapon and armor. */
  jubalLevel: number;
  jubalAt: Vec;
  allowedArmor: ArmorClass[];
  defaultArmor: ArmorClass;
  allies: Placement[];
  enemies: Placement[];
  /** Boss arena metadata. */
  boss?: { sweepRowStart: number; sweepCols: [number, number]; eye: Vec };
  targetTurns: string;
  danger: string;
}

export interface Setup {
  weaponId: string;
  armor: ArmorClass;
}

export type Outcome = 'ongoing' | 'victory' | 'defeat';

export interface UnitTelemetry {
  turns: number;
  moveAp: number;
  actionAp: number;
  waitAp: number;
  damageDealt: number;
  damageTaken: number;
  attacks: number;
  hits: number;
  kos: number;
  escapes: number;
  caught: number;
  disengageAttempts: number;
  disengageFails: number;
}

export interface BattleState {
  encounterId: string;
  seed: number;
  rng: Rng;
  config: RulesConfig;
  clock: number;
  map: { width: number; height: number; tiles: Terrain[] };
  units: UnitState[];
  effects: DelayedEffect[];
  active: ActiveTurn | null;
  outcome: Outcome;
  seq: number;
  /** AI memory (e.g. how long a ranged unit has hidden from the boss). */
  memory: Record<string, number>;
  telemetry: Record<string, UnitTelemetry>;
  boss: EncounterDef['boss'] | null;
  log: GameEvent[];
}

// ---- Actions ----
export type Action =
  | { type: 'move'; unitId: string; to: Vec }
  | { type: 'attack'; unitId: string; target: Vec }
  | { type: 'skill'; unitId: string; skillId: string; target: Vec }
  | { type: 'endTurn'; unitId: string };

// ---- Events (log + animation) ----
export interface ReactionResult {
  kind: 'dodge' | 'parry' | 'block';
  chance: number;
  roll: number;
  success: boolean;
}

export type GameEvent =
  | { t: 'turnStart'; unitId: string; clock: number }
  | { t: 'move'; unitId: string; path: Vec[]; cost: number }
  | { t: 'disengage'; unitId: string; engagerId: string; chance: number; roll: number; held: boolean }
  | { t: 'attack'; attackerId: string; name: string; tiles: Vec[]; apCost: number; free?: boolean; targetTile: Vec }
  | {
      t: 'strike';
      attackerId: string;
      targetId: string;
      hitChance: number;
      hitRoll: number;
      hit: boolean;
      reactions: ReactionResult[];
      avoided: 'dodge' | 'parry' | 'block' | null;
      displacedTo?: Vec;
      raw?: number;
      crit?: boolean;
      defense?: number;
      effectiveDefense?: number;
      flanked?: boolean;
      damage?: number;
      hpAfter?: number;
    }
  | { t: 'ko'; unitId: string }
  | { t: 'status'; unitId: string; status: 'dazed' | 'feared' | 'recovered'; pushback?: number }
  | { t: 'displace'; unitId: string; from: Vec; to: Vec; reason: 'push' | 'pull' | 'dodge' }
  | { t: 'effectCast'; effect: DelayedEffect }
  | { t: 'effectResolve'; effectId: string; name: string; tiles: Vec[]; hits: { unitId: string; damage: number; hpAfter: number }[] }
  | { t: 'turnEnd'; unitId: string; spent: number; delay: number; nextTurnAt: number }
  | { t: 'outcome'; outcome: Outcome }
  | { t: 'info'; text: string };
