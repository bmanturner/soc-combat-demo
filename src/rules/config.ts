// Every tunable rule lives here. Each setting carries where it came from, so the designer can
// tell Aaron's rules apart from Multivac's tentative math and from demo-only defaults.

export type SettingStatus = 'source' | 'tentative' | 'demo';

import type { PlayerWeaponFamily } from './types';
export const PLAYER_FAMILIES: PlayerWeaponFamily[] = ['daggers', 'shield', 'polearm', 'two_handed', 'bow', 'crossbow', 'dual_wield', 'javelin_shield', 'colossal'];
export const ENEMY_TEMPLATES = ['small_rat', 'brood_rat', 'large_rat', 'wolf', 'bandit_fighter', 'bandit_archer', 'rat_brood_mother', 'cultist_fighter', 'cultist_mage', 'nephilim'] as const;
export type EnemyTemplateId = typeof ENEMY_TEMPLATES[number];
type Tuning = Record<`wpn_${PlayerWeaponFamily}_${'dmg' | 'hit'}` | `enemy_${EnemyTemplateId}_${'hp' | 'dmg'}`, number>;
const TUNING_DEFAULTS = Object.fromEntries([
  ...PLAYER_FAMILIES.flatMap(f => [[`wpn_${f}_dmg`, 1], [`wpn_${f}_hit`, 0]]),
  ...ENEMY_TEMPLATES.flatMap(f => [[`enemy_${f}_hp`, 1], [`enemy_${f}_dmg`, 1]]),
]) as Tuning;
const ENEMY_BALANCE_WHY: Partial<Record<keyof Tuning, string>> = {
  enemy_small_rat_dmg: '1→.8: tutorial safety margin for slow starters; 100-seed pre-budget candidate raised axe wins 97.5% baseline (40 seeds) to 100%, HP 61.2→70.6%. Final confirmation in BALANCE.md.',
  enemy_cultist_fighter_dmg: 'Second pass .5→.75: restore the zealot threat after the parity-only nerf trivialized the shrine. Pair with local melee focus and Seer ×1.5, rather than restoring ×1 physical attrition: the latter left expert light javelin at 80% wins in 100 seeds. Full confirmation and remaining C1 misses in BALANCE.md.',
  enemy_cultist_mage_dmg: 'Second pass .5→1.5: make the Seer a real priority and move challenge toward telegraphed magic, rather than disproportionately punishing light melee with zealot blades. Joint .75/1.5 screen: expert light minimum 85% wins, HP spread 25.74pp. These are demo numbers, not new canon; final confirmation and misses in BALANCE.md.',
  enemy_nephilim_hp: 'Second pass .9→.95 (1080→1140 HP): counterweight to sweep depth 3→2 and streak cap 1. Final 100-seed novice win 49.67%, family spread 46.67pp vs 65.67pp before; expert dual still exceeds its win ceiling (99.67%). HP ×1 screened bow below 80% before curing dual. Full evidence and honest misses in BALANCE.md.',
};

export interface RulesConfig extends Tuning {
  proficientAllWeapons: boolean;
  unlockSpecialWeapons: boolean;
  crossbowReload: 'flexible' | 'strict';
  weaponSwapAp: number;
  // Timeline
  movementBudget: number;
  noActionTurnAp: number;
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
  broodMaxRats: number;
  broodLargeRatChance: number;
  playerDamageMult: number;
  enemyDamageMult: number;
  enemyHpMult: number;
  sweepStreakCap: number;
  rockThrowFallback: 'ranged-only' | 'any-exposed';
}

export const DEFAULT_CONFIG: RulesConfig = {
  ...TUNING_DEFAULTS,
  enemy_small_rat_dmg: .8,
  enemy_cultist_fighter_dmg: .75,
  enemy_cultist_mage_dmg: 1.5,
  enemy_nephilim_hp: .95,
  proficientAllWeapons: true,
  unlockSpecialWeapons: true,
  crossbowReload: 'flexible',
  weaponSwapAp: 50,
  movementBudget: 50,
  noActionTurnAp: 25,
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
  sweepDelay: 100,
  sweepDepth: 2,
  sweepDamage: 350,
  sweepArmorPen: 0.5,
  rockThrowDamage: 150,
  rockfallDelay: 100,
  rockfallDamage: 220,
  coverCampTurns: 2,
  bossBreakFreeAt: 1200,
  wolfPackFear: true,
  broodMaxRats: 4,
  broodLargeRatChance: 0.25,
  playerDamageMult: 1,
  enemyDamageMult: 1,
  enemyHpMult: 1,
  sweepStreakCap: 1,
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
  ...ENEMY_TEMPLATES.flatMap((f): SettingDef[] => ['hp', 'dmg'].map(k => ({ key: `enemy_${f}_${k}` as keyof RulesConfig, label: `${f} ${k}`, group: 'Enemy tuning', type: 'number', min: .5, max: 1.5, step: .05, unit: 'x', status: 'demo', why: ENEMY_BALANCE_WHY[`enemy_${f}_${k}` as keyof Tuning] ?? 'Per-template multiplier on authored base numbers, applied once alongside the global enemy multiplier.' }))),
  // Timeline
  { key: 'movementBudget', label: 'Movement AP per turn', group: 'Timeline', type: 'number', min: 20, max: 100, step: 5, unit: 'AP', status: 'source', why: 'Aaron: movement turns cap at 50 AP → 5/4/3 tiles for light/medium/heavy.' },
  { key: 'autoEndTurn', label: 'Auto-end exhausted turns', group: 'Timeline', type: 'boolean', status: 'demo', why: 'After acting, end automatically when movement is locked or less than one tile remains. Toggle off for manual timing experiments.' },
  { key: 'noActionTurnAp', label: 'Turn without an action adds', group: 'Timeline', type: 'number', min: 5, max: 100, step: 5, unit: 'AP', status: 'source', why: 'Aaron (playtest ruling): ending a turn without taking any action (attack, skill, reload or swap) adds 25 AP on top of the movement spent; applies to enemies too. Not yet in the wiki: Transcriptions › Combat Actions / Turn Flow says the delay is the AP spent. A Wait costs just this surcharge; the 5 AP minimum prevents zero-time loops.' },
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
  { key: 'bossTurnAp', label: 'Nephilim acts every', group: 'Nephilim', type: 'number', min: 50, max: 200, step: 5, unit: 'AP', status: 'demo', why: 'Undefined. Every 100 AP gives a readable rhythm against the 100 AP demo sweep delay.' },
  { key: 'sweepDelay', label: 'Sweep telegraph delay', group: 'Nephilim', type: 'number', min: 25, max: 150, step: 5, unit: 'AP', status: 'demo', why: 'Tentative 75→100 AP for a readable response window. Alongside damage 500→350, rock 170→150, HP ×.9 and deadline 1200: 40-seed novice boss win 47.04%, slow colossal 25%, rather than baseline 0% colossal. 150 AP made the boss trivial; see BALANCE.md.' },
  { key: 'sweepDepth', label: 'Sweep zone depth', group: 'Nephilim', type: 'number', min: 1, max: 6, step: 1, unit: 'tiles', status: 'demo', why: 'Second pass 3→2: preserve the lethal hit-and-get-out lesson while shortening escape routes. Depth 3 plus sweep cap 1 drove novice colossal to 6.67% in the 40-seed screen; depth 2 raised it to 41.67% before the compensating HP increase. Final full-grid confirmation and misses in BALANCE.md.' },
  { key: 'sweepDamage', label: 'Sweep raw damage', group: 'Nephilim', type: 'number', min: 100, max: 1000, step: 25, unit: 'dmg', status: 'demo', why: 'Aaron: overwhelming, possibly one-shot. Demo 500→350: remains lethal to light armor, but medium/heavy can survive one mistake. Paired tuning produced 47.04% novice boss wins at 40 seeds/armor; see BALANCE.md.' },
  { key: 'sweepArmorPen', label: 'Sweep armor penetration', group: 'Nephilim', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Keeps heavy armor from shrugging off the lesson.' },
  { key: 'rockThrowDamage', label: 'Rock throw raw damage', group: 'Nephilim', type: 'number', min: 0, max: 300, step: 10, unit: 'dmg', status: 'demo', why: 'Demo 170→150: maintain exposed-ranged pressure without the baseline bow boss outlier (75% expert wins). Paired candidate improved bow to 89.17% expert at 40 seeds/armor; see BALANCE.md, not an isolated causal claim.' },
  { key: 'rockfallDelay', label: 'Rockfall-behind-cover delay', group: 'Nephilim', type: 'number', min: 25, max: 200, step: 5, unit: 'AP', status: 'demo', why: 'Aaron: delayed AoE that flushes cover campers. Delay undefined.' },
  { key: 'rockfallDamage', label: 'Rockfall raw damage', group: 'Nephilim', type: 'number', min: 0, max: 500, step: 10, unit: 'dmg', status: 'demo', why: 'Hurts badly but is survivable once.' },
  { key: 'bossBreakFreeAt', label: 'Nephilim tears free at (0 = never)', group: 'Nephilim', type: 'number', min: 0, max: 5000, step: 100, unit: 'AP', status: 'demo', why: 'Aaron: kill him before he escapes. Demo deadline 1300→1200 compensates the longer warning and lower boss HP; retains a real race. Paired 40-seed candidate expert family wins 89.17–98.33% vs several near-perfect baseline families. Final evidence in BALANCE.md.' },
  { key: 'coverCampTurns', label: 'Boss turns before flushing cover', group: 'Nephilim', type: 'number', min: 1, max: 5, step: 1, unit: 'turns', status: 'demo', why: 'Boss turns a ranged unit may hide unseen before rockfall targets it.' },
  // Encounter knobs
  { key: 'wolfPackFear', label: 'Wolves scatter when one dies', group: 'Encounters', type: 'boolean', status: 'source', why: "Aaron's possible pack mechanic: survivors flee for a turn, then regroup." },
  { key: 'broodMaxRats', label: 'Brood Mother: most rats alive at once', group: 'Encounters', type: 'number', min: 2, max: 12, step: 1, status: 'demo', why: 'Aaron: the brood mother summons smaller rats. The cap on living brood rats (small and large) is a demo limit so the fight always ends. Demo 6→4 alongside Tentative Math brood-rat damage and a 150 AP summon cooldown: a 20-seed screen kept every family at 90%+ wins with fewer KOs; 100-seed confirmation pending.' },
  { key: 'broodLargeRatChance', label: 'Brood Mother: chance a summon is a Large Rat', group: 'Encounters', type: 'number', min: 0, max: 1, step: 0.05, unit: '%', status: 'demo', why: 'Rolled per summoned rat. Large Rat stats follow Tentative Math; the brood mother calling them, and this chance, are demo choices.' },
  { key: 'playerDamageMult', label: 'Party damage multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'enemyDamageMult', label: 'Enemy damage multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'enemyHpMult', label: 'Enemy HP multiplier', group: 'Encounters', type: 'number', min: 0.25, max: 3, step: 0.05, unit: 'x', status: 'demo', why: 'Global difficulty knob.' },
  { key: 'sweepStreakCap', label: 'Sweeps before exposed ranged pressure', group: 'Nephilim', type: 'number', min: 1, max: 10, step: 1, unit: 'turns', status: 'demo', why: 'Second pass 2→1: exposed ranged units receive a rock after one consecutive sweep rather than safely exploiting two sweep commitments. Alone it also killed the companion sooner and over-punished novice melee; pair with depth 2 and HP ×.95. Final evidence and remaining C3 misses in BALANCE.md.' },
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
