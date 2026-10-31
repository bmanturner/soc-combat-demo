// Weapons, armor and skills. Values tagged in comments: [source] Aaron, [tentative] Tentative Math, [demo] demo default.

import type { ArmorClass, ArmorDef, AttackMode, FieldProvenance, SkillDef, WeaponDef } from '../rules/types';

function armorProvenance(id: ArmorClass): Pick<ArmorDef, 'provenance' | 'fieldProvenance'> {
  const demo: FieldProvenance = { owner: 'demo', status: 'demo', why: 'Exact secondary stat is a sandbox proposal, not an Aaron number.' };
  return {
    provenance: { concept: 'source', numbers: 'demo', why: 'Aaron: ordinary starting clothing and light/medium/heavy armor concepts; approximate armor bands 100/200/300. Exact MR, dodge and engagement/disengagement bonuses are demo. Movement costs are sourced separately in Rules.' },
    fieldProvenance: {
      armor: id === 'clothing' ? { ...demo, why: 'Clothing armor 25 is a demo value.' } : { owner: 'Aaron', status: 'source', why: 'Aaron’s approximate light/medium/heavy armor bands: 100/200/300; implemented as exact sandbox defaults.' },
      mr: demo, dodge: demo, engagement: demo, disengagement: demo,
    },
  };
}
export const ARMOR: Record<ArmorClass, ArmorDef> = {
  // [source] Jubal starts in ordinary clothing; armor numbers [demo].
  clothing: { ...armorProvenance('clothing'), id: 'clothing', name: 'Village Clothing', armor: 25, mr: 0, dodge: 0.15, engagement: 0, disengagement: 3, blurb: 'A rope-tied robe. Light on your feet, light on protection.' },
  // [source] bands ~100/200/300 Armor; move 10/12.5/15 AP per tile. Engagement directions [source], numbers [demo].
  light: { ...armorProvenance('light'), id: 'light', name: 'Light Armor', armor: 100, mr: 25, dodge: 0.15, engagement: 1, disengagement: 4, blurb: '5 tiles per move. Slips out of melee. Takes 50% of physical damage.' },
  medium: { ...armorProvenance('medium'), id: 'medium', name: 'Medium Armor', armor: 200, mr: 40, dodge: 0.08, engagement: 3, disengagement: 3, blurb: '4 tiles per move. The safe middle. Takes 33% of physical damage.' },
  heavy: { ...armorProvenance('heavy'), id: 'heavy', name: 'Heavy Armor', armor: 300, mr: 50, dodge: 0, engagement: 5, disengagement: 1, blurb: '3 tiles per move. Pins enemies, gets pinned. Takes 25% of physical damage.' },
};

const phys = { damageType: 'physical' as const, ranged: false };

const WEAPON_SEEDS: Record<string, Omit<WeaponDef, 'modes' | 'basicSkill' | 'proficiencySkill' | 'provenance' | 'fieldProvenance'>> = {
  // ---- Jubal's four melee starters: source patterns/AP; retuned demo damage; demo hit, pen and reactions.
  daggers: {
    id: 'daggers', name: 'Bronze Daggers', family: 'daggers',
    attack: { name: 'Dagger strike', pattern: 'cardinal', apCost: 50, damage: 38, hit: 0.88, pctPen: 0, flatPen: 15, ...phys },
    canEngage: true, engagement: 0, disengagement: 4, parry: 0.05, block: 0, dodgeBonus: 0.05, skills: ['throwing_knife'],
    blurb: 'Hits one tile N/E/S/W. Fast and slippery in melee.',
  },
  shield: {
    id: 'shield', name: 'Sword & Shield', family: 'shield',
    attack: { name: 'Sword strike', pattern: 'pairCw', apCost: 75, damage: 55, hit: 0.86, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 5, disengagement: 0, parry: 0.05, block: 0.3, dodgeBonus: 0, skills: ['shield_bash'],
    blurb: 'Hits the target tile + the next tile clockwise. Blocks. Pins enemies in place.',
  },
  polearm: {
    id: 'polearm', name: 'Bronze Spear', family: 'polearm',
    attack: { name: 'Spear thrust', pattern: 'line2', apCost: 100, damage: 72, hit: 0.84, pctPen: 0.1, flatPen: 10, ...phys },
    canEngage: true, engagement: 3, disengagement: 2, parry: 0.1, block: 0, dodgeBonus: 0, skills: ['hook'],
    blurb: 'Hits two tiles in a straight line. Reach lets you strike from outside the danger.',
  },
  two_handed: {
    id: 'two_handed', name: 'Two-Handed Axe', family: 'two_handed',
    attack: { name: 'Great swing', pattern: 'arc5', apCost: 125, damage: 101, hit: 0.78, pctPen: 0.2, flatPen: 10, ...phys },
    canEngage: true, engagement: 3, disengagement: 1, parry: 0.1, block: 0, dodgeBonus: 0, skills: ['overhead_smash'],
    blurb: 'Hits five of the eight tiles around you. Heavy damage, slow commitment.',
  },
  // ---- Companions
  shepherds_club: {
    id: 'shepherds_club', name: "Shepherd's Club", family: 'two_handed',
    attack: { name: 'Club swing', pattern: 'arc5', apCost: 125, damage: 72, hit: 0.8, pctPen: 0.3, flatPen: 0, ...phys },
    canEngage: true, engagement: 3, disengagement: 1, parry: 0.05, block: 0, dodgeBonus: 0, skills: ['heavy_daze'],
    blurb: "Jabal's two-handed club [source]. Blunt: percentage armor penetration.",
  },
  hunting_bow: {
    id: 'hunting_bow', name: 'Hunting Bow', family: 'bow',
    attack: { name: 'Arrow', pattern: 'ranged', apCost: 75, stationaryDiscount: true, range: [2, 10], damage: 58, hit: 0.87, pctPen: 0, flatPen: 10, damageType: 'physical', ranged: true },
    canEngage: false, engagement: 0, disengagement: 2, parry: 0, block: 0, dodgeBonus: 0, skills: ['aimed_shot'],
    blurb: 'Long ranged reach with a stationary discount. Movement adds the configured bow surcharge. Cannot engage.',
  },
  crossbow: {
    id: 'crossbow', name: 'Bronze Crossbow', family: 'crossbow',
    attack: { name: 'Bolt', pattern: 'ranged', apCost: 50, range: [1, 6], damage: 79, hit: .85, pctPen: .15, flatPen: 5, damageType: 'physical', ranged: true },
    reloadAp: 50, canEngage: false, engagement: 0, disengagement: 2, parry: 0, block: 0, dodgeBonus: 0, skills: ['steady_bolt', 'breaching_bolt'],
    blurb: 'A loaded frontline opener. A paid reload separates shots.',
  },
  dual_wield: {
    id: 'dual_wield', name: 'Dual Blades', family: 'dual_wield', access: 'savage+rogue',
    attack: { name: 'Dual strike', pattern: 'dualArc', apCost: 100, damage: 40, hit: .85, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 2, disengagement: 3, parry: .08, block: 0, dodgeBonus: .03, skills: ['measured_cut', 'disorient'],
    blurb: 'A primary strike then one random living enemy in the five-cell arc.',
  },
  javelin_shield: {
    id: 'javelin_shield', name: 'Javelin & Shield', family: 'javelin_shield', access: 'soldier+rogue',
    attack: { name: 'Javelin thrust', pattern: 'adjacent', apCost: 75, damage: 55, hit: .86, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 4, disengagement: 1, parry: .05, block: .25, dodgeBonus: 0, skills: ['shield_check', 'piercing_javelin'],
    blurb: 'Thrust or throw; the shield and melee threat remain. Unlimited throws (demo).',
  },
  colossal: {
    id: 'colossal', name: 'Colossal Hammer', family: 'colossal', access: 'soldier+savage',
    attack: { name: 'Colossal line', pattern: 'line2', apCost: 175, damage: 130, hit: .72, pctPen: .25, flatPen: 0, ...phys },
    canEngage: true, engagement: 4, disengagement: 0, parry: .10, block: 0, dodgeBonus: 0, skills: ['crushing_blow', 'stunning_impact'],
    blurb: 'A straight line or every adjacent tile. No two-handed side accuracy penalties.',
  },
  // ---- Monsters
  rat_bite: {
    id: 'rat_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'cardinal', apCost: 80, damage: 10, hit: 0.75, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  // Brood rat: 25 damage per 100 AP (Drafts/09 / Tentative Math small rat), without the Granary's tutorial cut.
  brood_rat_bite: {
    id: 'brood_rat_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'cardinal', apCost: 80, damage: 20, hit: 0.75, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  // Large rat: 35 damage per 100 AP (Tentative Math).
  large_rat_bite: {
    id: 'large_rat_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'cardinal', apCost: 80, damage: 28, hit: 0.75, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  wolf_bite: {
    id: 'wolf_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'adjacent', apCost: 80, damage: 40, hit: 0.8, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 2, disengagement: 4, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  // Bandits: damage per 100 AP follows Tentative Math (fighter 60, archer 55).
  bandit_blade: {
    id: 'bandit_blade', name: 'Bronze Sword & Buckler', family: 'natural',
    attack: { name: 'Sword cut', pattern: 'pairCw', apCost: 75, damage: 45, hit: 0.82, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 4, disengagement: 1, parry: 0.05, block: 0.2, dodgeBonus: 0, skills: [], blurb: '',
  },
  bandit_bow: {
    id: 'bandit_bow', name: 'Short Bow', family: 'natural',
    attack: { name: 'Arrow', pattern: 'ranged', apCost: 75, stationaryDiscount: true, range: [2, 8], damage: 41, hit: 0.8, pctPen: 0, flatPen: 5, damageType: 'physical', ranged: true },
    canEngage: false, engagement: 0, disengagement: 2, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  brood_bite: {
    id: 'brood_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'adjacent', apCost: 80, damage: 22, hit: 0.75, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  cultist_blade: {
    id: 'cultist_blade', name: 'Ritual Blade & Shield', family: 'shield',
    attack: { name: 'Ritual blade', pattern: 'pairCw', apCost: 75, damage: 45, hit: 0.82, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 5, disengagement: 0, parry: 0.05, block: 0.25, dodgeBonus: 0, skills: [], blurb: '',
  },
  cultist_staff: {
    id: 'cultist_staff', name: 'Ritual Staff', family: 'staff',
    attack: { name: 'Staff', pattern: 'adjacent', apCost: 75, damage: 22, hit: 0.8, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0.05, block: 0, dodgeBonus: 0, skills: ['daze_bolt', 'hellfire_sigil'], blurb: '',
  },
  nephilim_arm: {
    id: 'nephilim_arm', name: 'Free Arm', family: 'natural',
    attack: { name: 'Crush', pattern: 'adjacent', apCost: 100, damage: 150, hit: 0.9, pctPen: 0.3, flatPen: 0, ...phys },
    canEngage: true, engagement: 10, disengagement: 0, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
};

const DEMO_FIELD: FieldProvenance = { owner: 'demo', status: 'demo', why: 'Demo content/parameter choice; not an acquired skill-tree benefit or a source number.' };
const TENTATIVE_DAMAGE: FieldProvenance = { owner: 'Drafts/09', status: 'tentative', why: 'Initial raw damage budget from Drafts/09 Tentative Math. Accuracy, penetration and reactions remain demo.' };
const SOURCE_AP: Record<string, string> = {
  daggers: 'The base cost for making an attack with daggers is 50 AP.',
  shield: 'The AP cost to swing a one-handed weapon with a shield is the standard 75 AP.',
  polearm: 'Polearms have an AP cost of 100 AP.',
  two_handed: 'The AP cost to swing a two-handed weapon is 125 AP.',
  bow: 'The bow has a base AP cost of 75 AP.',
  crossbow: 'On a character’s turn with the crossbow, they can attack for 50 AP.',
  dual_wield: 'Attacks while dual wielding cost 100 AP.',
  javelin_shield: 'These melee attacks cost 75 AP. Throwing the javelin costs 125 AP.',
  colossal: 'Colossal weapons have a massive AP cost of 175 AP.',
};
const sourceField = (why: string): FieldProvenance => ({ owner: 'Aaron', status: 'source', why });
function profileFields(mode: AttackMode, family: string, source: boolean, tentative: boolean): Record<string, FieldProvenance> {
  return Object.fromEntries(Object.keys(mode).map(k => [k,
    k === 'damage' && tentative ? TENTATIVE_DAMAGE
      : k === 'apCost' && source ? sourceField(`Aaron’s Transcriptions / ${family}: “${SOURCE_AP[family]}”`)
      : ['pattern', 'range'].includes(k) && source ? sourceField(`Aaron’s Transcriptions / ${family} weapon-pattern section; ranges interpreted as Chebyshev distance (demo grid convention).`)
      : k === 'stationaryDiscount' && source ? sourceField('“The only way to get the bow’s low AP cost of 75 is to not move on the same turn.”')
      : DEMO_FIELD,
  ]));
}
const BALANCE_DAMAGE: Record<string, string> = {
  daggers: '45→38; isolated no-reaction damage/100 AP 81.22→68.55.',
  shield: '60→55; isolated no-reaction damage/100 AP 70.52→64.67.',
  polearm: '85→72; isolated no-reaction damage/100 AP 73.21→61.99. The intermediate 75-damage candidate still won 98.33% expert boss trials (40 seeds/armor).',
  two_handed: '115→101; isolated no-reaction damage/100 AP 73.57→64.62; side penalties unchanged.',
  hunting_bow: '65→58; isolated stationary damage/100 AP 77.31→68.96; also affects the companion bow.',
  crossbow: '85→79; fire+reload damage/100 AP 74.08→68.85. The intermediate 80-damage confirmation won 97.33% expert boss trials; 79 reduced that to 97.00% at 100 seeds/armor.',
  dual_wield: '42→40 per strike; two-hit damage/100 AP 73.18→69.70. Do not confuse low realized bot throughput with basic damage budget.',
  javelin_shield: 'Thrust 60→55, throw 80→70; damage/100 AP 64.67 and 49.36.',
  colossal: '135→130; single-target damage/100 AP 56.94→54.82; 175 AP and huge AoE unchanged.',
};
const SECOND_SKILLS: Record<string, string> = { daggers: 'precision_stab', shield: 'sundering_blow', polearm: 'piercing_cast', two_handed: 'staggering_blow', hunting_bow: 'piercing_arrow' };
export const PLAYER_WEAPON_IDS = ['daggers', 'shield', 'polearm', 'two_handed', 'hunting_bow', 'crossbow', 'dual_wield', 'javelin_shield', 'colossal'] as const;
export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(Object.values(WEAPON_SEEDS).map(w => {
  const skills = SECOND_SKILLS[w.id] ? [...w.skills, SECOND_SKILLS[w.id]!] : w.skills;
  const id = w.family === 'crossbow' ? 'fire' : w.family === 'javelin_shield' ? 'thrust' : w.family === 'colossal' ? 'line' : 'basic';
  const modes: WeaponDef['modes'] = w.family === 'javelin_shield'
    ? [{ ...w.attack, id }, { ...w.attack, id: 'throw', name: 'Javelin throw', pattern: 'ranged', range: [2, 4], apCost: 125, damage: 70, ranged: true }]
    : w.family === 'colossal' ? [{ ...w.attack, id }, { ...w.attack, id: 'sweep', name: 'Colossal sweep', pattern: 'ring8' }]
    : [{ ...w.attack, id, ...(w.family === 'crossbow' ? { ammo: 'bolt' as const } : {}) }];
  const tentative = ['daggers', 'shield', 'polearm', 'two_handed', 'hunting_bow', 'crossbow', 'bandit_blade', 'bandit_bow', 'brood_rat_bite', 'large_rat_bite'].includes(w.id);
  const source = PLAYER_WEAPON_IDS.some(x => x === w.id) || w.id === 'shepherds_club';
  const fields: Record<string, FieldProvenance> = Object.fromEntries([...Object.keys(w), 'basicSkill', 'proficiencySkill'].map(k => [k, DEMO_FIELD]));
  if (w.reloadAp) fields.reloadAp = sourceField('“On their next turn, they need to use a combat action to reload it, which also costs 50 AP.”');
  const fieldProvenance = { fields, attack: profileFields(modes[0]!, w.family, source, tentative), modes: Object.fromEntries(modes.map(m => [m.id, profileFields(m, w.family, source, tentative)])) };
  const balanceWhy = BALANCE_DAMAGE[w.id];
  if (balanceWhy) {
    const damage: FieldProvenance = { owner: 'demo', status: 'demo', why: `${balanceWhy} See notes/balance/BALANCE.md; source AP, ranges and patterns unchanged.` };
    fieldProvenance.attack.damage = damage;
    for (const mode of Object.values(fieldProvenance.modes)) mode.damage = damage;
  }
  return [w.id, { ...w, modes, skills, fieldProvenance, basicSkill: skills[0] ?? null, proficiencySkill: skills[1] ?? null,
    provenance: { concept: PLAYER_WEAPON_IDS.some(x => x === w.id) || w.id === 'shepherds_club' ? 'source' : 'demo', numbers: balanceWhy ? 'demo' : tentative ? 'tentative' : 'demo', why: balanceWhy ? `Demo balance: ${balanceWhy} See notes/balance/BALANCE.md.` : 'Concept: Aaron weapon notes. Raw damage: Drafts/09 where present; accuracy, penetration and defenses are demo proposals. New special damage and all skill numbers are demo.' } }];
}));

const SKILL_SEEDS: Record<string, Omit<SkillDef, 'provenance' | 'fieldProvenance'>> = {
  precision_stab: { id: 'precision_stab', name: 'Precision Stab', kind: 'strike', modeId: 'basic', apCost: 75, cooldown: 200, damageMult: 1.25, pctPenBonus: .25, description: 'An adjacent armor-piercing strike.', status: 'demo' },
  sundering_blow: { id: 'sundering_blow', name: 'Sundering Blow', kind: 'strike', modeId: 'basic', apCost: 100, cooldown: 250, damageMult: 1.25, pctPenBonus: .20, description: 'An adjacent armor-piercing strike.', status: 'demo' },
  piercing_cast: { id: 'piercing_cast', name: 'Piercing Cast', kind: 'shot', modeId: 'basic', apCost: 125, cooldown: 250, range: [2, 3], needsLos: true, damageMult: 1.2, pctPenBonus: .20, description: 'Cast the spear through armor. No ammunition requirement (demo).', status: 'demo' },
  staggering_blow: { id: 'staggering_blow', name: 'Staggering Blow', kind: 'strike', modeId: 'basic', apCost: 150, cooldown: 300, damageMult: 1, applies: 'dazed', description: 'An adjacent strike that dazes on hit.', status: 'demo' },
  piercing_arrow: { id: 'piercing_arrow', name: 'Piercing Arrow', kind: 'shot', modeId: 'basic', apCost: 125, cooldown: 300, range: [2, 10], needsLos: true, damageMult: 1.3, pctPenBonus: .35, stationaryDiscount: true, description: 'An armor-piercing shot. Movement adds the bow surcharge.', status: 'demo' },
  steady_bolt: { id: 'steady_bolt', name: 'Steady Bolt', kind: 'shot', modeId: 'fire', consumesBolt: true, apCost: 75, cooldown: 200, range: [1, 6], needsLos: true, damageMult: 1, hitBonus: .10, description: 'An accurate shot; consumes the loaded bolt.', status: 'demo' },
  breaching_bolt: { id: 'breaching_bolt', name: 'Breaching Bolt', kind: 'shot', modeId: 'fire', consumesBolt: true, apCost: 100, cooldown: 300, range: [1, 6], needsLos: true, damageMult: 1.25, pctPenBonus: .25, description: 'An armor-piercing shot; consumes the loaded bolt.', status: 'demo' },
  measured_cut: { id: 'measured_cut', name: 'Measured Cut', kind: 'strike', modeId: 'basic', apCost: 100, cooldown: 200, damageMult: 1.8, hitBonus: .05, description: 'One deliberate cut, not a random second strike.', status: 'demo' },
  disorient: { id: 'disorient', name: 'Disorient', kind: 'strike', modeId: 'basic', apCost: 125, cooldown: 300, damageMult: 1.5, applies: 'dazed', description: 'A single cut that dazes.', status: 'demo' },
  shield_check: { id: 'shield_check', name: 'Shield Check', kind: 'shove', modeId: 'thrust', apCost: 75, cooldown: 200, damageMult: .5, description: 'An adjacent shove; dazes if blocked.', status: 'demo' },
  piercing_javelin: { id: 'piercing_javelin', name: 'Piercing Javelin', kind: 'shot', modeId: 'throw', apCost: 150, cooldown: 300, range: [2, 4], needsLos: true, damageMult: 1.25, pctPenBonus: .25, description: 'An armor-piercing throw.', status: 'demo' },
  crushing_blow: { id: 'crushing_blow', name: 'Crushing Blow', kind: 'strike', modeId: 'line', apCost: 175, cooldown: 250, damageMult: 1.3, description: 'A concentrated adjacent blow.', status: 'demo' },
  stunning_impact: { id: 'stunning_impact', name: 'Stunning Impact', kind: 'strike', modeId: 'line', apCost: 200, cooldown: 350, damageMult: 1, applies: 'dazed', description: 'An adjacent blow that dazes.', status: 'demo' },
  // [source] concept: every weapon has a basic skill anyone can use. Specific skills are [demo] placeholders.
  throwing_knife: { id: 'throwing_knife', name: 'Throwing Knife', kind: 'shot', apCost: 75, cooldown: 150, range: [2, 4], needsLos: true, damageMult: 0.8, description: 'A ranged knife to finish fleeing targets.', status: 'demo' },
  shield_bash: { id: 'shield_bash', name: 'Shield Bash', kind: 'shove', apCost: 75, cooldown: 200, damageMult: 0.5, description: 'Adjacent shove. Slammed into something? Dazed.', status: 'demo' },
  hook: { id: 'hook', name: 'Hook', kind: 'hook', apCost: 100, cooldown: 200, range: [2, 2], damageMult: 0.5, description: 'A straight-line hook that drags the target next to you.', status: 'demo' },
  overhead_smash: { id: 'overhead_smash', name: 'Overhead Smash', kind: 'strike', apCost: 150, cooldown: 300, damageMult: 1.5, pctPenBonus: 0.3, hitBonus: -0.05, description: 'A committed adjacent strike with additional armor penetration.', status: 'demo' },
  // [source] Jabal gains "a basic active skill such as a heavy daze attack".
  heavy_daze: { id: 'heavy_daze', name: 'Heavy Daze', kind: 'strike', apCost: 125, cooldown: 300, damageMult: 1.0, applies: 'dazed', description: 'One adjacent target. Full damage and Dazed: knocked back on the timeline, no reactions until their next turn ends.', status: 'source' },
  aimed_shot: { id: 'aimed_shot', name: 'Aimed Shot', kind: 'shot', apCost: 100, cooldown: 200, range: [2, 10], needsLos: true, damageMult: 1.4, hitBonus: 0.1, stationaryDiscount: true, description: 'A precise, powerful shot. Moving this turn adds the configured bow surcharge.', status: 'demo' },
  // [source] cultist mages have basic crowd control. Specific spells [demo].
  daze_bolt: { id: 'daze_bolt', name: 'Daze Bolt', kind: 'shot', apCost: 100, cooldown: 150, range: [2, 6], needsLos: true, damageMult: 1, rawDamage: 35, damageType: 'magic', applies: 'dazed', description: 'A ranged magic bolt that dazes.', status: 'demo' },
  // [source] concept: the brood mother summons smaller rats. Large Rats among them, and all numbers, are [demo].
  call_the_brood: { id: 'call_the_brood', name: 'Call the Brood', kind: 'summon', apCost: 100, cooldown: 150, damageMult: 1, summon: { template: 'brood_rat', name: 'Brood Rat', count: 2, delay: 50, variant: { template: 'large_rat', name: 'Large Rat' } }, description: 'Calls up to two rats onto open tiles beside her, each sometimes a Large Rat; they act 50 AP later.', status: 'source' },
  // Nephilim. Numbers come from the rules config (Nephilim group) so they can be tuned live.
  nephilim_sweep: { id: 'nephilim_sweep', name: 'Sweeping Arm', kind: 'sweep', allowedReactions: [], special: 'sweep', apCost: 100, cooldown: 0, damageMult: 1, damageType: 'physical', description: 'Telegraphs a sweep across the whole zone in front of him. Lands after a delay. Lethal.', status: 'source' },
  rock_throw: { id: 'rock_throw', name: 'Rock Throw', kind: 'shot', special: 'rockThrow', apCost: 100, cooldown: 0, range: [2, 12], needsLos: true, damageMult: 1, rawDamage: 110, hitBonus: -0.05, damageType: 'physical', description: 'Hurls debris at an exposed target. Cover blocks it.', status: 'source' },
  rockfall: { id: 'rockfall', name: 'Rockfall', kind: 'sigil', allowedReactions: [], special: 'rockfall', apCost: 100, cooldown: 0, range: [0, 20], radius: 1, damageMult: 1, rawDamage: 220, damageType: 'physical', delay: 100, description: 'Brings the ceiling down behind cover a ranged unit is hiding behind.', status: 'source' },
  hellfire_sigil: { id: 'hellfire_sigil', name: 'Hellfire Sigil', kind: 'sigil', allowedReactions: [], apCost: 125, cooldown: 350, range: [0, 6], damageMult: 1, rawDamage: 65, damageType: 'magic', delay: 100, radius: 1, description: 'Brands an area with delayed hellfire; friendly eligibility follows the configured rule.', status: 'demo' },
};
export const SKILLS: Record<string, SkillDef> = Object.fromEntries(Object.values(SKILL_SEEDS).map(s => [s.id, {
  ...s, fieldProvenance: Object.fromEntries([...Object.keys(s), 'modeId'].map(k => [k, s.id === 'throwing_knife' && k === 'damageMult' ? { ...DEMO_FIELD, why: 'Demo multiplier .6→.8 offsets the dagger raw-budget reduction (knife raw 27→30.4) without increasing the source basic tempo. Not a claim that knife alone fixes cultists; see candidate-i and BALANCE.md.' } : DEMO_FIELD])), modeId: s.modeId ?? 'basic', provenance: { concept: s.status, numbers: 'demo', why: s.id === 'throwing_knife' ? 'Demo multiplier .6→.8: preserve ranged finishing utility while lowering basic raw damage. See notes/balance/BALANCE.md.' : s.status === 'source' ? 'Aaron names this concept; all numeric parameters are demo defaults.' : 'Demo completion of item-owned skills; not an authored skill-tree claim.' },
}]));
