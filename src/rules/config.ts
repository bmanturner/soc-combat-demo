// Every tunable rule lives here. Each setting carries where it came from, so the designer can
// tell Aaron's rules apart from Multivac's tentative math and from demo-only defaults.

export type SettingStatus = 'source' | 'tentative' | 'demo';

import type { PlayerWeaponFamily } from './types';
export const PLAYER_FAMILIES: PlayerWeaponFamily[] = ['daggers', 'shield', 'polearm', 'two_handed', 'bow', 'crossbow', 'dual_wield', 'javelin_shield', 'colossal'];
export const ENEMY_TEMPLATES = ['small_rat', 'wolf', 'cultist_fighter', 'cultist_mage', 'nephilim'] as const;
export type EnemyTemplateId = typeof ENEMY_TEMPLATES[number];
type Tuning = Record<`wpn_${PlayerWeaponFamily}_${'dmg' | 'hit'}` | `enemy_${EnemyTemplateId}_${'hp' | 'dmg'}`, number>;
const TUNING_DEFAULTS = Object.fromEntries([
  ...PLAYER_FAMILIES.flatMap(f => [[`wpn_${f}_dmg`, 1], [`wpn_${f}_hit`, 0]]),
  ...ENEMY_TEMPLATES.flatMap(f => [[`enemy_${f}_hp`, 1], [`enemy_${f}_dmg`, 1]]),
]) as Tuning;
export interface RulesConfig extends Tuning {
  proficientAllWeapons: boolean;
  unlockSpecialWeapons: boolean;
  crossbowReload: 'flexible' | 'strict';
  weaponSwapAp: number;
  // Timeline
  movementBudget: number;
  minTurnDelay: number;
  autoEndTurn: boolean;
  tieUnitBeforeEffect: boolean;
  tiePlayerFirst: boolean;
  // Movement
  moveApClothing: number;
  moveApLight: number;
  moveApMedium: number;
  moveApHeavy: number;
  diagonalMovement: boolean;
  // Engagement
  engageBase: number;
  engagePerPoint: number;
  engageMin: number;
  engageMax: number;
  multiEngager: 'highest' | 'each';
  aooChance: number;
  bossesEngage: boolean;
  // Flanking
  flankDamageTaken: number;
  flankReactionMult: number;
  flankDiagonals: boolean;
  // Attacks
  friendlyFire: boolean;
  delayedHitsAllies: boolean;
  critChance: number;
  critMult: number;
  twoHandedNearPenalty: number;
  twoHandedFarPenalty: number;
  bowMoveSurcharge: number;
  // Reactions
  reactionsEnabled: boolean;
  dodgeAp: number;
  parryAp: number;
  blockAp: number;
  dodgeDisplaces: boolean;
  // Status
  dazedPushback: number;
  bossDazeMult: number;
  // Boss
  bossTurnAp: number;
  sweepDelay: number;
  sweepDepth: number;
  sweepDamage: number;
  sweepArmorPen: number;
  rockThrowDamage: number;
  rockfallDelay: number;
  rockfallDamage: number;
  coverCampTurns: number;
  bossBreakFreeAt: number;
  // Encounter knobs
  wolfPackFear: boolean;
  playerDamageMult: number;
  enemyDamageMult: number;
  enemyHpMult: number;
  sweepStreakCap: number;
  rockThrowFallback: 'ranged-only' | 'any-exposed';
}

export const DEFAULT_CONFIG: RulesConfig = {
  ...TUNING_DEFAULTS,
  proficientAllWeapons: true,
  unlockSpecialWeapons: true,
  crossbowReload: 'flexible',
  weaponSwapAp: 50,
  movementBudget: 50,
  minTurnDelay: 25,
  autoEndTurn: true,
  tieUnitBeforeEffect: true,
  tiePlayerFirst: true,
  moveApClothing: 10,
  moveApLight: 10,
  moveApMedium: 12.5,
  moveApHeavy: 15,
  diagonalMovement: false,
  engageBase: 0.2,
  engagePerPoint: 0.1,
  engageMin: 0.05,
  engageMax: 0.95,
  multiEngager: 'highest',
  aooChance: 0.5,
  bossesEngage: false,
  flankDamageTaken: 0.25,
  flankReactionMult: 0.5,
  flankDiagonals: false,
  friendlyFire: false,
  delayedHitsAllies: true,
  critChance: 0.05,
  critMult: 1.5,
  twoHandedNearPenalty: 0.1,
  twoHandedFarPenalty: 0.2,
  bowMoveSurcharge: 50,
  reactionsEnabled: true,
  dodgeAp: 25,
  parryAp: 25,
  blockAp: 35,
  dodgeDisplaces: true,
  dazedPushback: 50,
  bossDazeMult: 0.5,
  bossTurnAp: 100,
  sweepDelay: 75,
  sweepDepth: 3,
  sweepDamage: 500,
  sweepArmorPen: 0.5,
  rockThrowDamage: 170,
  rockfallDelay: 100,
  rockfallDamage: 220,
  coverCampTurns: 2,
  bossBreakFreeAt: 1300,
  wolfPackFear: true,
  playerDamageMult: 1,
  enemyDamageMult: 1,
  enemyHpMult: 1,
  sweepStreakCap: 2,
  rockThrowFallback: 'any-exposed',
};

interface BaseSetting {
  key: keyof RulesConfig;
  label: string;
  group: string;
  status: SettingStatus;
  why: string;
}
export type SettingDef =
  | (BaseSetting & { type: 'number'; min: number; max: number; step: number; unit?: 'AP' | '%' | 'x' | 'tiles' | 'turns' | 'dmg' })
  | (BaseSetting & { type: 'boolean' })
  | (BaseSetting & { type: 'select'; options: { value: string; label: string }[] });

export const SETTINGS: SettingDef[] = [
  { key: 'proficientAllWeapons', label: 'All weapon proficiencies (sandbox)', group: 'Weapons', type: 'boolean', status: 'demo', why: 'No skill trees are modeled. Enables second item skills for testing, not earned Soldier / Savage / Rogue proficiency.' },
  { key: 'unlockSpecialWeapons', label: 'Unlock special weapons (sandbox)', group: 'Weapons', type: 'boolean', status: 'demo', why: 'Test Juggernaut, Hoplite and Dual-Wielder items without modeling Tier-2 tree combinations.' },
  { key: 'weaponSwapAp', label: 'Swap weapon', group: 'Weapons', type: 'number', min: 25, max: 100, step: 5, unit: 'AP', status: 'demo', why: 'Swapping consumes the combat action (source); this delay is a demo proposal.' },
  { key: 'crossbowReload', label: 'Crossbow reload policy', group: 'Weapons', type: 'select', options: [{ value: 'flexible', label: 'Flexible opener' }, { value: 'strict', label: 'Strict next combat action' }], status: 'demo', why: 'Aaron: “The purpose of the crossbow is for frontline fighters who want to get a shot off at range before engaging in melee combat.” Also: “However, on their next turn, they need to use a combat action to reload it, which also costs 50 AP.” Flexible permits fire → swap → melee; strict requires reload before any other combat action. Both require a paid reload between shots.' },
  ...PLAYER_FAMILIES.flatMap((f): SettingDef[] => [
    { key: `wpn_${f}_dmg`, label: `${f} damage`, group: 'Weapon tuning', type: 'number', min: .5, max: 1.5, step: .05, unit: 'x', status: 'demo', why: 'Scales every mode and item skill once. Base damage remains in content; this is a sandbox balance control.' },
    { key: `wpn_${f}_hit`, label: `${f} accuracy`, group: 'Weapon tuning', type: 'number', min: -.2, max: .2, step: .01, unit: '%', status: 'demo', why: 'Additive hit modifier for every family mode and skill; final hit chance is clamped by the shared resolver.' },
  ]),
  ...ENEMY_TEMPLATES.flatMap((f): SettingDef[] => ['hp', 'dmg'].map(k => ({ key: `enemy_${f}_${k}` as keyof RulesConfig, label: `${f} ${k}`, group: 'Enemy tuning', type: 'number', min: .5, max: 1.5, step: .05, unit: 'x', status: 'demo', why: 'Per-template multiplier on authored base numbers, applied once alongside the global enemy multiplier.' }))),
  // Timeline
  { key: 'movementBudget', label: 'Movement AP per turn', group: 'Timeline', type: 'number', min: 20, max: 100, step: 5, unit: 'AP', status: 'source', why: 'Aaron: movement turns cap at 50 AP → 5/4/3 tiles for light/medium/heavy.' },
  { key: 'autoEndTurn', label: 'Auto-end exhausted turns', group: 'Timeline', type: 'boolean', status: 'demo', why: 'After acting, end automatically when movement is locked or less than one tile remains. Toggle off for manual timing experiments.' },
  { key: 'minTurnDelay', label: 'Wait (empty turn) costs', group: 'Timeline', type: 'number', min: 5, max: 100, step: 5, unit: 'AP', status: 'demo', why: 'Empty turns cost 25 AP by default to prevent zero-time loops; nonempty turns cost AP actually spent. The minimum configurable wait is 5 AP.' },
  { key: 'tieUnitBeforeEffect', label: 'Ties: units act before effects land', group: 'Timeline', type: 'boolean', status: 'demo', why: 'Undefined. Units first makes a 0 AP escape margin survivable ("exact timing"), matching the Tentative Math reading.' },
  { key: 'tiePlayerFirst', label: 'Ties: party acts before enemies', group: 'Timeline', type: 'boolean', status: 'demo', why: 'Undefined. Predictable and slightly player-favoured.' },
  // Movement
  { key: 'moveApClothing', label: 'Move AP/tile: clothing', group: 'Movement', type: 'number', min: 5, max: 20, step: 0.5, unit: 'AP', status: 'demo', why: 'Undefined. Ordinary clothing moves like light armor.' },
  { key: 'moveApLight', label: 'Move AP/tile: light', group: 'Movement', type: 'number', min: 5, max: 20, step: 0.5, unit: 'AP', status: 'source', why: 'Aaron: light armor costs 10 AP per square.' },
  { key: 'moveApMedium', label: 'Move AP/tile: medium', group: 'Movement', type: 'number', min: 5, max: 25, step: 0.5, unit: 'AP', status: 'source', why: 'Aaron: medium armor costs 12.5 AP per square.' },
  { key: 'moveApHeavy', label: 'Move AP/tile: heavy', group: 'Movement', type: 'number', min: 5, max: 30, step: 0.5, unit: 'AP', status: 'source', why: 'Aaron: heavy armor costs 15 AP per square.' },
  { key: 'diagonalMovement', label: 'Allow diagonal movement', group: 'Movement', type: 'boolean', status: 'demo', why: 'Undefined (attacks are 8-way, movement unspecified). Off = Fire Emblem style 4-way movement, which keeps flanking, engagement and escape distances meaningful.' },
  // Engagement
  { key: 'engageBase', label: 'Keep-engaged base chance', group: 'Engagement', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'source', why: 'Aaron: 20% base chance to keep a target engaged.' },
  { key: 'engagePerPoint', label: 'Chance per score point', group: 'Engagement', type: 'number', min: 0, max: 0.25, step: 0.01, unit: '%', status: 'source', why: "Implied by Aaron's example: +4 score difference adds 40%." },
  { key: 'engageMin', label: 'Keep-engaged floor', group: 'Engagement', type: 'number', min: 0, max: 0.5, step: 0.05, unit: '%', status: 'demo', why: 'Undefined. A small floor so engagement always matters a little.' },
  { key: 'engageMax', label: 'Keep-engaged ceiling', group: 'Engagement', type: 'number', min: 0.5, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Undefined. Never fully root a unit.' },
  { key: 'multiEngager', label: 'Several adjacent engagers', group: 'Engagement', type: 'select', options: [{ value: 'highest', label: 'Highest score rolls once' }, { value: 'each', label: 'Each engager rolls' }], status: 'demo', why: 'Undefined. One roll against the best engager is easiest to read.' },
  { key: 'aooChance', label: 'Attack of opportunity chance', group: 'Engagement', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Aaron: chance-based, "not necessarily 100%". 50% until playtested.' },
  { key: 'bossesEngage', label: 'Bosses engage adjacent units', group: 'Engagement', type: 'boolean', status: 'demo', why: 'Undefined. Off: a failed disengage inside a lethal telegraph is an unreadable death. The boss threat is timing, not pinning.' },
  // Flanking
  { key: 'flankDamageTaken', label: 'Flanked: extra damage taken', group: 'Flanking', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Aaron: flanked units take increased damage. Amount undefined.' },
  { key: 'flankReactionMult', label: 'Flanked: reaction multiplier', group: 'Flanking', type: 'number', min: 0, max: 1, step: 0.05, unit: 'x', status: 'demo', why: 'Aaron: reduced block/parry/dodge. Amount undefined.' },
  { key: 'flankDiagonals', label: 'Diagonal pairs also flank', group: 'Flanking', type: 'boolean', status: 'demo', why: "Aaron's examples are N/S and E/W only." },
  // Attacks
  { key: 'friendlyFire', label: 'Weapon patterns hit allies', group: 'Attacks', type: 'boolean', status: 'demo', why: 'Undefined. Off: Jabal and Jubal fight shoulder to shoulder without the two-handed arc punishing them. Telegraphed AoEs still hit everyone.' },
  { key: 'delayedHitsAllies', label: 'Delayed AoEs hit their own side', group: 'Attacks', type: 'boolean', status: 'demo', why: 'Undefined. On: you can shove cultists into their own sigils, and enemies avoid walking into them.' },
  { key: 'critChance', label: 'Critical chance', group: 'Attacks', type: 'number', min: 0, max: 0.5, step: 0.01, unit: '%', status: 'tentative', why: 'Simulation default.' },
  { key: 'critMult', label: 'Critical multiplier', group: 'Attacks', type: 'number', min: 1, max: 3, step: 0.1, unit: 'x', status: 'tentative', why: 'Simulation default.' },
  { key: 'twoHandedNearPenalty', label: 'Two-handed: near side-tile hit penalty', group: 'Attacks', type: 'number', min: 0, max: 0.5, step: 0.05, unit: '%', status: 'demo', why: 'Aaron: extra tiles get accuracy penalties. Amount undefined.' },
  { key: 'twoHandedFarPenalty', label: 'Two-handed: far side-tile hit penalty', group: 'Attacks', type: 'number', min: 0, max: 0.5, step: 0.05, unit: '%', status: 'demo', why: 'Aaron: extra tiles get accuracy penalties. Amount undefined.' },
  { key: 'bowMoveSurcharge', label: 'Bow: surcharge if you move that turn', group: 'Attacks', type: 'number', min: 0, max: 100, step: 5, unit: 'AP', status: 'source', why: 'Aaron: bow is 75 AP standing still, 125 if you move. Moving after firing applies the surcharge too.' },
  // Reactions
  { key: 'reactionsEnabled', label: 'Dodge / block / parry', group: 'Reactions', type: 'boolean', status: 'source', why: 'Aaron: checked highest-first against the remaining chance. Rolled automatically here.' },
  { key: 'dodgeAp', label: 'Dodge AP pushback', group: 'Reactions', type: 'number', min: 0, max: 100, step: 5, unit: 'AP', status: 'demo', why: 'Aaron: reactions cost AP. Amount undefined.' },
  { key: 'parryAp', label: 'Parry AP pushback', group: 'Reactions', type: 'number', min: 0, max: 100, step: 5, unit: 'AP', status: 'demo', why: 'Aaron: parry costs AP. Amount undefined.' },
  { key: 'blockAp', label: 'Block AP pushback', group: 'Reactions', type: 'number', min: 0, max: 100, step: 5, unit: 'AP', status: 'demo', why: 'Aaron: block costs more AP than parry.' },
  { key: 'dodgeDisplaces', label: 'Dodge pushes you 1 tile back', group: 'Reactions', type: 'boolean', status: 'source', why: 'Aaron: dodging displaces one tile away from the attack.' },
  // Status
  { key: 'dazedPushback', label: 'Dazed: timeline pushback', group: 'Status', type: 'number', min: 0, max: 150, step: 5, unit: 'AP', status: 'demo', why: 'Undefined. In an AP game the natural "daze" is lost time: +AP on the timeline, and no reactions until your next turn ends.' },
  { key: 'bossDazeMult', label: 'Bosses: daze effectiveness', group: 'Status', type: 'number', min: 0, max: 1, step: 0.05, unit: 'x', status: 'demo', why: 'Massive enemies shrug off half the pushback, so dazing the boss is a tactic, not a lock.' },
  // Boss
  { key: 'bossTurnAp', label: 'Nephilim acts every', group: 'Nephilim', type: 'number', min: 50, max: 200, step: 5, unit: 'AP', status: 'demo', why: 'Undefined. Every 100 AP gives a readable rhythm against the 75 AP sweep.' },
  { key: 'sweepDelay', label: 'Sweep telegraph delay', group: 'Nephilim', type: 'number', min: 25, max: 150, step: 5, unit: 'AP', status: 'tentative', why: 'Tentative Math default. Its escape analysis used the wrong model, so tune it here.' },
  { key: 'sweepDepth', label: 'Sweep zone depth', group: 'Nephilim', type: 'number', min: 1, max: 6, step: 1, unit: 'tiles', status: 'demo', why: 'The real lever: at 3 every armor can escape with good timing; at 4+ heavy armor deep in the zone cannot.' },
  { key: 'sweepDamage', label: 'Sweep raw damage', group: 'Nephilim', type: 'number', min: 100, max: 1000, step: 25, unit: 'dmg', status: 'demo', why: 'Aaron: overwhelming, possibly one-shot. 500 raw with 50% armor pen kills any Act One loadout.' },
  { key: 'sweepArmorPen', label: 'Sweep armor penetration', group: 'Nephilim', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Keeps heavy armor from shrugging off the lesson.' },
  { key: 'rockThrowDamage', label: 'Rock throw raw damage', group: 'Nephilim', type: 'number', min: 0, max: 300, step: 10, unit: 'dmg', status: 'demo', why: 'Punishes exposed units without one-shotting them. Tuned up from 130: at 130 a disciplined party finished with ~80% HP and the boss was easier than the cultists.' },
  { key: 'rockfallDelay', label: 'Rockfall-behind-cover delay', group: 'Nephilim', type: 'number', min: 25, max: 200, step: 5, unit: 'AP', status: 'demo', why: 'Aaron: delayed AoE that flushes cover campers. Delay undefined.' },
  { key: 'rockfallDamage', label: 'Rockfall raw damage', group: 'Nephilim', type: 'number', min: 0, max: 500, step: 10, unit: 'dmg', status: 'demo', why: 'Hurts badly but is survivable once.' },
  { key: 'bossBreakFreeAt', label: 'Nephilim tears free at (0 = never)', group: 'Nephilim', type: 'number', min: 0, max: 5000, step: 100, unit: 'AP', status: 'demo', why: 'Aaron: kill him "before he can escape, while he is still trapped and vulnerable." A visible clock makes playing too safe a losing strategy: AP discipline, not AP hoarding. 1300 (tuned from 1800, which never triggered): the bot finishes in ~950–1150 AP, so slow heavy builds now lose some runs.' },
  { key: 'coverCampTurns', label: 'Boss turns before flushing cover', group: 'Nephilim', type: 'number', min: 1, max: 5, step: 1, unit: 'turns', status: 'demo', why: 'Boss turns a ranged unit may hide unseen before rockfall targets it.' },
  // Encounter knobs
  { key: 'wolfPackFear', label: 'Wolves scatter when one dies', group: 'Encounters', type: 'boolean', status: 'source', why: "Aaron's possible pack mechanic: survivors flee for a turn, then regroup." },
  { key: 'playerDamageMult', label: 'Party damage multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'enemyDamageMult', label: 'Enemy damage multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'enemyHpMult', label: 'Enemy HP multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'sweepStreakCap', label: 'Sweeps before exposed ranged pressure', group: 'Nephilim', type: 'number', min: 1, max: 10, step: 1, unit: 'turns', status: 'demo', why: 'Bounds sweep bait: after this many consecutive sweeps an exposed ranged foe gets a rock instead.' },
  { key: 'rockThrowFallback', label: 'Rock throw fallback targets', group: 'Nephilim', type: 'select', options: [{ value: 'ranged-only', label: 'Ranged only' }, { value: 'any-exposed', label: 'Any exposed foe' }], status: 'demo', why: 'Prefer ranged pressure; optionally throw at exposed melee when no ranged target is visible.' },
];

/** Validate and clamp untrusted overrides (from a shared URL) against the registry. */
export function sanitizeOverrides(input: unknown): Partial<RulesConfig> {
  const out: Partial<RulesConfig> = {};
  if (!input || typeof input !== 'object') return out;
  const rec = input as Record<string, unknown>;
  for (const s of SETTINGS) {
    const raw = rec[s.key];
    if (raw === undefined) continue;
    if (s.type === 'number' && typeof raw === 'number' && Number.isFinite(raw)) {
      (out as Record<string, unknown>)[s.key] = Math.min(s.max, Math.max(s.min, raw));
    } else if (s.type === 'boolean' && typeof raw === 'boolean') {
      (out as Record<string, unknown>)[s.key] = raw;
    } else if (s.type === 'select' && typeof raw === 'string' && s.options.some((o) => o.value === raw)) {
      (out as Record<string, unknown>)[s.key] = raw;
    }
  }
  return out;
}

export function withOverrides(overrides: Partial<RulesConfig>): RulesConfig {
  return { ...DEFAULT_CONFIG, ...sanitizeOverrides(overrides) };
}

/** Only the keys that differ from defaults; this is what goes in a share link. */
export function diffFromDefaults(config: RulesConfig): Partial<RulesConfig> {
  const out: Partial<RulesConfig> = {};
  for (const s of SETTINGS) {
    if (config[s.key] !== DEFAULT_CONFIG[s.key]) (out as Record<string, unknown>)[s.key] = config[s.key];
  }
  return out;
}
