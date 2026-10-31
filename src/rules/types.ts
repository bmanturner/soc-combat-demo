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
export type PatternKind = 'cardinal' | 'pairCw' | 'line2' | 'arc5' | 'adjacent' | 'ranged' | 'dualArc' | 'ring8';

export interface AttackProfile {
  name: string;
  pattern: PatternKind;
  apCost: number;
  /** Bow rule: stationary price. If the unit moves this turn (before or after), it pays apCost + config.bowMoveSurcharge. */
  stationaryDiscount?: boolean;
  allowedReactions?: ReactionResult['kind'][];
  range?: [number, number];
  damage: number;
  hit: number;
  damageType: DamageType;
  pctPen: number;
  flatPen: number;
  /** Ranged attacks can't be parried. */
  ranged: boolean;
}

export type PlayerWeaponFamily = 'daggers' | 'shield' | 'polearm' | 'two_handed' | 'bow' | 'crossbow' | 'dual_wield' | 'javelin_shield' | 'colossal';
export type WeaponFamily = PlayerWeaponFamily | 'natural' | 'staff';
export interface FieldProvenance { owner: 'Aaron' | 'Drafts/09' | 'demo'; status: 'source' | 'tentative' | 'demo'; why: string }
export interface Provenance { concept: 'source' | 'demo'; numbers: 'tentative' | 'demo'; why: string }
export interface AttackMode extends AttackProfile { id: string; ammo?: 'bolt' }
export interface WeaponInstance {
  instanceId: string;
  defId: string;
  loaded: boolean;
  skillReadyAt: Record<string, number>;
}
export interface WeaponDef {
  fieldProvenance: { fields: Record<string, FieldProvenance>; attack: Record<string, FieldProvenance>; modes: Record<string, Record<string, FieldProvenance>> };
  modes: readonly AttackMode[];
  basicSkill: string | null;
  proficiencySkill: string | null;
  reloadAp?: number;
  access?: 'normal' | 'soldier+savage' | 'soldier+rogue' | 'savage+rogue';
  provenance: Provenance;
  id: string;
  name: string;
  family: WeaponFamily;
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
  provenance: Provenance;
  fieldProvenance: Record<string, FieldProvenance>;
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
  | 'sweep' // boss: delayed effect over the encounter's sweep zone
  | 'summon'; // spawns copies of summon.template on open tiles beside the caster

export interface SkillDef {
  fieldProvenance: Record<string, FieldProvenance>;
  modeId?: string;
  consumesBolt?: boolean;
  provenance: Provenance;
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
  allowedReactions?: ReactionResult['kind'][];
  delay?: number;
  radius?: number; // sigil: Chebyshev radius of the area
  /** Boss abilities whose numbers come from the rules config (so they're tunable live). */
  special?: 'sweep' | 'rockThrow' | 'rockfall';
  /** Summon skills: the unit template to spawn, the display name for spawned units, the most units spawned per cast, and the AP after the cast at which they first act.
   *  `variant` replaces a spawned unit with probability `config.broodLargeRatChance`, rolled per unit. */
  summon?: { template: string; name: string; count: number; delay: number; variant?: { template: string; name: string } };
  description: string;
  status: 'source' | 'demo';
}

export type AiKind = 'swarm' | 'charger' | 'guardian' | 'caster' | 'nephilim' | 'skirmisher' | 'brood';

export interface UnitTemplate {
  provenance: Provenance;
  fieldProvenance: Record<string, FieldProvenance>;
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
  secondaryWeapon?: string;
  skills?: string[];
  ai?: AiKind;
  footprint?: Vec[]; // relative offsets; default single tile
  immobile?: boolean;
  massive?: boolean; // bosses: half daze, no displacement
  initiative?: number; // starting AP on the timeline
  level?: number;
}

export interface UnitState {
  carried: [WeaponInstance, WeaponInstance | null];
  equippedSlot: 0 | 1;
  personalSkills: { id: string; readyAt: number }[];
  proficiencies: WeaponFamily[];
  unlockedSpecialFamilies: WeaponFamily[];
  reloadOwedSlot: 0 | 1 | null;
  turnOrdinal: number;
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
  /** Explicit policy captured at cast time; absent legacy effects mean none. */
  allowedReactions?: ReactionResult['kind'][];
  origin?: Vec;
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
  /** Each unit's chance to get out, noted whenever it holds the turn before impact; explains catches. */
  escapeChances?: Record<string, EscapeChance>;
  /** Per unit, whether its latest turn end inside the area predicted it could still escape (the next-turn ghost's verdict). */
  endTurnPreviewSafe?: Record<string, boolean>;
}

/** At a unit's turn before impact: already clear or able to reach a clear tile, boxed in, or held while leaving. */
export type EscapeChance = 'couldEscape' | 'trapped' | 'held';

/** Why an eligible unit was caught: its turn came after impact, it had no way out, it was held, or it ended inside. */
export type CaughtReason = 'late' | 'trapped' | 'held' | 'stayed';

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
  /** Legacy input accepted; weaponIds takes precedence. */
  weaponId?: string;
  weaponIds?: [string, string | null];
  equippedSlot?: 0 | 1;
  armor: ArmorClass;
}

export type Outcome = 'ongoing' | 'victory' | 'defeat';

/** Per attack or skill (keyed by its log name): how a pattern actually landed. */
export interface PatternStats {
  kind: 'attack' | 'skill';
  /** Weapon carried when used; null for personal skills. */
  weaponId: string | null;
  uses: number;
  /** Sum over uses of distinct enemies the attack swung at. */
  enemiesTargeted: number;
  /** Sum over uses of distinct enemies that took damage. */
  enemiesDamaged: number;
  /** Uses that swung at two or more distinct enemies. */
  multiTargetUses: number;
  /** Uses that damaged two or more distinct enemies. */
  multiHitUses: number;
  mostEnemiesTargeted: number;
  alliesTargeted: number;
  damage: number;
}

export interface UnitTelemetry {
  reloads: number;
  swaps: number;
  turns: number;
  /** Turn shape: acted with no whole tile of movement left / acted with movement left / ended without a combat action. */
  turnsAllIn: number;
  turnsActedWithMoveLeft: number;
  turnsNoAction: number;
  /** Movement budget left unspent at turn ends. */
  moveLeftAp: number;
  moveAp: number;
  actionAp: number;
  waitAp: number;
  /** Timeline delay from this unit's own dodge / parry / block, and from being dazed. */
  reactionAp: number;
  dazedAp: number;
  damageDealt: number;
  damageTaken: number;
  attacks: number;
  hits: number;
  kos: number;
  escapes: number;
  caught: number;
  caughtBy: Record<CaughtReason, number>;
  /** Caught although this unit's last turn end inside the area predicted it could still get out. */
  caughtAfterSafePreview: number;
  disengageAttempts: number;
  disengageFails: number;
  /** When and by what this unit was knocked out, if it was. */
  downed: { at: number; by: string } | null;
  patterns: Record<string, PatternStats>;
}

export interface BattleState {
  /** Canonical starting loadout; never replaced by in-battle swaps. */
  setup: { weaponIds: [string, string | null]; equippedSlot: 0 | 1; armor: ArmorClass };
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
  | { type: 'attack'; unitId: string; target: Vec; modeId?: string }
  | { type: 'reload'; unitId: string }
  | { type: 'swapWeapon'; unitId: string; slot: 0 | 1 }
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
  | { t: 'reload'; unitId: string; slot: 0 | 1; name: string; apCost: number }
  | { t: 'swapWeapon'; unitId: string; slot: 0 | 1; oldName: string; newName: string; apCost: number }
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
  | { t: 'effectResolve'; effectId: string; name: string; tiles: Vec[]; at: number; hits: { unitId: string; damage: number; hpAfter: number; reactions?: ReactionResult[]; avoided?: ReactionResult['kind'] | null; displacedTo?: Vec; caught?: { reason: CaughtReason; nextTurnAt: number; previewSafe?: boolean } }[]; /** Living units threatened at cast who were not hit. */ escaped: string[] }
  | { t: 'turnEnd'; unitId: string; spent: number; delay: number; nextTurnAt: number }
  | { t: 'outcome'; outcome: Outcome }
  | { t: 'spawn'; unitId: string; sourceId: string; at: Vec }
  | { t: 'info'; text: string };
