// Weapons, armor and skills. Values tagged in comments: [source] Aaron, [tentative] Tentative Math, [demo] demo default.

import type { ArmorClass, ArmorDef, SkillDef, WeaponDef } from '../rules/types';

export const ARMOR: Record<ArmorClass, ArmorDef> = {
  // [source] Jubal starts in ordinary clothing; armor numbers [demo].
  clothing: { id: 'clothing', name: 'Village Clothing', armor: 25, mr: 0, dodge: 0.15, engagement: 0, disengagement: 3, blurb: 'A rope-tied robe. Light on your feet, light on protection.' },
  // [source] bands ~100/200/300 Armor; move 10/12.5/15 AP per tile. Engagement directions [source], numbers [demo].
  light: { id: 'light', name: 'Light Armor', armor: 100, mr: 25, dodge: 0.15, engagement: 1, disengagement: 4, blurb: '5 tiles per move. Slips out of melee. Takes 50% of physical damage.' },
  medium: { id: 'medium', name: 'Medium Armor', armor: 200, mr: 40, dodge: 0.08, engagement: 3, disengagement: 3, blurb: '4 tiles per move. The safe middle. Takes 33% of physical damage.' },
  heavy: { id: 'heavy', name: 'Heavy Armor', armor: 300, mr: 50, dodge: 0, engagement: 5, disengagement: 1, blurb: '3 tiles per move. Pins enemies, gets pinned. Takes 25% of physical damage.' },
};

const phys = { damageType: 'physical' as const, ranged: false };

export const WEAPONS: Record<string, WeaponDef> = {
  // ---- Jubal's four melee starters [source patterns + AP], damage/hit [tentative], pen/reactions [demo]
  daggers: {
    id: 'daggers', name: 'Bronze Daggers', family: 'daggers',
    attack: { name: 'Dagger strike', pattern: 'cardinal', apCost: 50, damage: 45, hit: 0.88, pctPen: 0, flatPen: 15, ...phys },
    canEngage: true, engagement: 0, disengagement: 4, parry: 0.05, block: 0, dodgeBonus: 0.05, skills: ['throwing_knife'],
    blurb: 'Hits one tile N/E/S/W. 50 AP: you act constantly. Slippery in melee.',
  },
  shield: {
    id: 'shield', name: 'Sword & Shield', family: 'shield',
    attack: { name: 'Sword strike', pattern: 'pairCw', apCost: 75, damage: 60, hit: 0.86, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 5, disengagement: 0, parry: 0.05, block: 0.3, dodgeBonus: 0, skills: ['shield_bash'],
    blurb: 'Hits the target tile + the next tile clockwise. Blocks. Pins enemies in place.',
  },
  polearm: {
    id: 'polearm', name: 'Bronze Spear', family: 'polearm',
    attack: { name: 'Spear thrust', pattern: 'line2', apCost: 100, damage: 85, hit: 0.84, pctPen: 0.1, flatPen: 10, ...phys },
    canEngage: true, engagement: 3, disengagement: 2, parry: 0.1, block: 0, dodgeBonus: 0, skills: ['hook'],
    blurb: 'Hits two tiles in a straight line. Reach lets you strike from outside the danger.',
  },
  two_handed: {
    id: 'two_handed', name: 'Two-Handed Axe', family: 'two_handed',
    attack: { name: 'Great swing', pattern: 'arc5', apCost: 125, damage: 115, hit: 0.78, pctPen: 0.2, flatPen: 10, ...phys },
    canEngage: true, engagement: 3, disengagement: 1, parry: 0.1, block: 0, dodgeBonus: 0, skills: ['overhead_smash'],
    blurb: 'Hits five of the eight tiles around you. Huge damage, huge commitment: 125 AP.',
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
    attack: { name: 'Arrow', pattern: 'ranged', apCost: 75, stationaryDiscount: true, range: [2, 10], damage: 65, hit: 0.87, pctPen: 0, flatPen: 10, damageType: 'physical', ranged: true },
    canEngage: false, engagement: 0, disengagement: 2, parry: 0, block: 0, dodgeBonus: 0, skills: ['aimed_shot'],
    blurb: '2–10 tiles. 75 AP if you stay put, 125 if you move that turn [source]. Cannot engage.',
  },
  // ---- Monsters
  rat_bite: {
    id: 'rat_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'cardinal', apCost: 80, damage: 10, hit: 0.75, pctPen: 0, flatPen: 0, ...phys },
    canEngage: true, engagement: 1, disengagement: 3, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
  },
  wolf_bite: {
    id: 'wolf_bite', name: 'Bite', family: 'natural',
    attack: { name: 'Bite', pattern: 'adjacent', apCost: 80, damage: 40, hit: 0.8, pctPen: 0, flatPen: 10, ...phys },
    canEngage: true, engagement: 2, disengagement: 4, parry: 0, block: 0, dodgeBonus: 0, skills: [], blurb: '',
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

export const SKILLS: Record<string, SkillDef> = {
  // [source] concept: every weapon has a basic skill anyone can use. Specific skills are [demo] placeholders.
  throwing_knife: { id: 'throwing_knife', name: 'Throwing Knife', kind: 'shot', apCost: 75, cooldown: 150, range: [2, 4], needsLos: true, damageMult: 0.6, description: 'Ranged 2–4 tiles, 60% damage. Finish fleeing targets.', status: 'demo' },
  shield_bash: { id: 'shield_bash', name: 'Shield Bash', kind: 'shove', apCost: 75, cooldown: 200, damageMult: 0.5, description: 'Adjacent. 50% damage and shove the target 1 tile. Slammed into something? Dazed.', status: 'demo' },
  hook: { id: 'hook', name: 'Hook', kind: 'hook', apCost: 100, cooldown: 200, range: [2, 2], damageMult: 0.5, description: 'Target 2 tiles away in a straight line: 50% damage and drag them next to you.', status: 'demo' },
  overhead_smash: { id: 'overhead_smash', name: 'Overhead Smash', kind: 'strike', apCost: 150, cooldown: 300, damageMult: 1.5, pctPenBonus: 0.3, hitBonus: -0.05, description: 'One adjacent target. 150% damage, +30% armor penetration. 150 AP.', status: 'demo' },
  // [source] Jabal gains "a basic active skill such as a heavy daze attack".
  heavy_daze: { id: 'heavy_daze', name: 'Heavy Daze', kind: 'strike', apCost: 125, cooldown: 300, damageMult: 1.0, applies: 'dazed', description: 'One adjacent target. Full damage and Dazed: knocked back on the timeline, no reactions until their next turn ends.', status: 'source' },
  aimed_shot: { id: 'aimed_shot', name: 'Aimed Shot', kind: 'shot', apCost: 100, cooldown: 200, range: [2, 10], needsLos: true, damageMult: 1.4, hitBonus: 0.1, stationaryDiscount: true, description: '140% damage, +10% hit. Moving this turn adds the bow surcharge.', status: 'demo' },
  // [source] cultist mages have basic crowd control. Specific spells [demo].
  daze_bolt: { id: 'daze_bolt', name: 'Daze Bolt', kind: 'shot', apCost: 100, cooldown: 150, range: [2, 6], needsLos: true, damageMult: 1, rawDamage: 35, damageType: 'magic', applies: 'dazed', description: 'Magic bolt, 2–6 tiles. Dazes.', status: 'demo' },
  // Nephilim. Numbers come from the rules config (Nephilim group) so they can be tuned live.
  nephilim_sweep: { id: 'nephilim_sweep', name: 'Sweeping Arm', kind: 'sweep', special: 'sweep', apCost: 100, cooldown: 0, damageMult: 1, damageType: 'physical', description: 'Telegraphs a sweep across the whole zone in front of him. Lands after a delay. Lethal.', status: 'source' },
  rock_throw: { id: 'rock_throw', name: 'Rock Throw', kind: 'shot', special: 'rockThrow', apCost: 100, cooldown: 0, range: [2, 12], needsLos: true, damageMult: 1, rawDamage: 110, hitBonus: -0.05, damageType: 'physical', description: 'Hurls debris at an exposed target. Cover blocks it.', status: 'source' },
  rockfall: { id: 'rockfall', name: 'Rockfall', kind: 'sigil', special: 'rockfall', apCost: 100, cooldown: 0, range: [0, 20], radius: 1, damageMult: 1, rawDamage: 220, damageType: 'physical', delay: 100, description: 'Brings the ceiling down behind cover a ranged unit is hiding behind.', status: 'source' },
  hellfire_sigil: { id: 'hellfire_sigil', name: 'Hellfire Sigil', kind: 'sigil', apCost: 125, cooldown: 350, range: [0, 6], damageMult: 1, rawDamage: 65, damageType: 'magic', delay: 100, radius: 1, description: 'Brands a 3×3 area. Erupts 100 AP later and burns everyone inside, cultists included.', status: 'demo' },
};
