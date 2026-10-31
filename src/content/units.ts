// Unit templates and level curves.

import type { UnitTemplate } from '../rules/types';

/** [tentative] Tentative Math growth curve. */
export const JUBAL_HP: Record<number, number> = { 1: 120, 2: 135, 3: 150, 4: 170, 5: 190, 6: 215 };
export const DAMAGE_SCALE: Record<number, number> = { 1: 1.0, 2: 1.1, 3: 1.18, 4: 1.3, 5: 1.45, 6: 1.58 };

export function companionHp(templateId: string, level: number): number | null {
  if (templateId === 'jubal') return JUBAL_HP[level] ?? 120;
  if (templateId === 'jabal') return 150 + 12 * level;
  if (templateId === 'hired_archer') return 140 + 10 * level;
  return null;
}

const UNIT_SEEDS: Record<string, Omit<UnitTemplate, 'provenance' | 'fieldProvenance'>> = {
  jubal: { id: 'jubal', name: 'Jubal', glyph: 'J', side: 'player', role: 'Musician of the Cainites', hp: 120, armorClass: 'clothing', weapon: 'daggers', initiative: 0 },
  jabal: { id: 'jabal', name: 'Jabal', glyph: 'Jb', side: 'player', role: 'Shepherd, standard fighter', hp: 174, armorClass: 'light', weapon: 'shepherds_club', skills: ['heavy_daze'], initiative: 10 },
  hired_archer: { id: 'hired_archer', name: 'Hired Archer', glyph: 'A', side: 'player', role: 'Mercenary from the valley village', hp: 190, armorClass: 'light', weapon: 'hunting_bow', skills: ['aimed_shot'], initiative: 20 },

  small_rat: { id: 'small_rat', name: 'Granary Rat', glyph: 'r', side: 'enemy', role: 'Tutorial body', hp: 25, armorClass: 'light', armor: 0, mr: 0, dodge: 0.15, moveApPerTile: 10, weapon: 'rat_bite', ai: 'swarm', initiative: 30 },
  brood_rat: { id: 'brood_rat', name: 'Brood Rat', glyph: 'r', side: 'enemy', role: 'Small rat the brood mother calls', hp: 25, armorClass: 'light', armor: 0, mr: 0, dodge: 0.15, moveApPerTile: 10, weapon: 'brood_rat_bite', ai: 'swarm', initiative: 30 },
  large_rat: { id: 'large_rat', name: 'Large Rat', glyph: 'L', side: 'enemy', role: 'Tougher rat the brood mother sometimes calls', hp: 45, armorClass: 'light', armor: 25, mr: 0, dodge: 0.1, moveApPerTile: 10, weapon: 'large_rat_bite', ai: 'swarm', initiative: 30 },
  rat_brood_mother: { id: 'rat_brood_mother', name: 'Brood Mother', glyph: 'M', side: 'enemy', role: 'Summons smaller rats', hp: 110, armorClass: 'light', armor: 25, mr: 10, dodge: 0.05, moveApPerTile: 12.5, weapon: 'brood_bite', skills: ['call_the_brood'], ai: 'brood', initiative: 45 },
  wolf: { id: 'wolf', name: 'Wolf', glyph: 'W', side: 'enemy', role: 'Charges the closest target', hp: 80, armorClass: 'light', armor: 50, mr: 10, dodge: 0.2, moveApPerTile: 25 / 3, weapon: 'wolf_bite', ai: 'charger', initiative: 15 },
  bandit_fighter: { id: 'bandit_fighter', name: 'Bandit', glyph: 'F', side: 'enemy', role: 'Basic melee human', hp: 120, armorClass: 'light', armor: 100, mr: 25, dodge: 0.1, weapon: 'bandit_blade', ai: 'swarm', initiative: 30 },
  bandit_archer: { id: 'bandit_archer', name: 'Bandit Archer', glyph: 'R', side: 'enemy', role: 'Ranged pressure: shoots from range, steps out of melee', hp: 90, armorClass: 'light', armor: 50, mr: 20, dodge: 0.12, weapon: 'bandit_bow', ai: 'skirmisher', initiative: 40 },
  cultist_fighter: { id: 'cultist_fighter', name: 'Cultist Zealot', glyph: 'Z', side: 'enemy', role: 'Shield wall for the caster', hp: 130, armorClass: 'light', armor: 75, mr: 30, dodge: 0.08, weapon: 'cultist_blade', ai: 'guardian', initiative: 35 },
  cultist_mage: { id: 'cultist_mage', name: 'Cultist Seer', glyph: 'S', side: 'enemy', role: 'Dazes, brands the ground with fire', hp: 90, armorClass: 'light', armor: 25, mr: 60, dodge: 0.1, weapon: 'cultist_staff', skills: ['daze_bolt', 'hellfire_sigil'], ai: 'caster', initiative: 45 },
  nephilim: {
    id: 'nephilim', name: 'Trapped Nephilim', glyph: 'N', side: 'enemy', role: 'Pinned under the cave-in. One arm free.', hp: 1200, armorClass: 'heavy', armor: 100, mr: 100, dodge: 0, weapon: 'nephilim_arm', skills: ['nephilim_sweep', 'rock_throw', 'rockfall'], ai: 'nephilim',
    footprint: [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
    immobile: true, massive: true, initiative: 40,
  },
};

/** Enemy HP and armor taken from tentative tables, with the exact citation. */
const TENTATIVE_STATS: Record<string, { hp: string; armor: string }> = {
  bandit_fighter: { hp: 'Drafts/09 Prototype Unit Templates (tentative): bandit fighter 120 HP.', armor: 'Drafts/09 Prototype Unit Templates (tentative): bandit fighter 100 armor.' },
  bandit_archer: { hp: 'Drafts/09 Prototype Unit Templates (tentative): bandit archer 90 HP.', armor: 'Drafts/09 Prototype Unit Templates (tentative): bandit archer 50 armor.' },
  brood_rat: { hp: 'Drafts/09 / Tentative Math (tentative): small rat 25 HP.', armor: 'Drafts/09 / Tentative Math (tentative): small rat 0 armor.' },
  large_rat: { hp: 'Tentative Math Enemy Baseline (tentative): large rat 45 HP.', armor: 'Tentative Math Enemy Baseline (tentative): large rat 25 armor.' },
};

/** Concepts are Aaron's; these encounter labels and exact stat/AI realizations are not canon. */
export const UNITS: Record<string, UnitTemplate> = Object.fromEntries(Object.values(UNIT_SEEDS).map(u => {
  const isBandit = u.id === 'bandit_fighter' || u.id === 'bandit_archer';
  const why = u.id === 'small_rat' ? 'Aaron’s Granary rat encounter concept; “Granary Rat” label and all combat stats are demo.'
    : u.id === 'brood_rat' ? 'Aaron’s brood mother concept: she summons smaller rats. HP, armor and damage budget follow the Drafts/09 / Tentative Math small rat, untuned, unlike the tutorial Granary Rat; accuracy, defenses and the “Brood Rat” label are demo.'
    : u.id === 'large_rat' ? 'Aaron’s giant rat encounter concept; the Large Rat template is from Tentative Math. HP, armor and damage budget follow it; accuracy, defenses and its place in the brood mother’s summons are demo.'
    : u.id === 'jubal' ? 'Aaron’s Jubal character concept. HP and damage growth use Drafts/09 tentative math; initiative and exact demo kit are sandbox choices.'
    : u.id === 'jabal' ? 'Aaron’s Jabal/shepherd companion and club concept. HP curve 150 + 12 × level and exact combat stats are demo.'
    : u.id === 'hired_archer' ? 'Aaron’s hired archer companion concept. HP curve 140 + 10 × level and exact combat stats are demo.'
    : u.id === 'wolf' ? 'Aaron’s wolves/pack encounter concept. Exact HP, movement speed, defenses and AI implementation are demo.'
    : u.id === 'nephilim' ? 'Aaron’s trapped Nephilim encounter concept. Exact HP, footprint, defenses and initiative are demo.'
    : isBandit ? 'Aaron’s bandit concept: simple human encounters built from basic fighters and archers. HP, armor and damage budget follow Drafts/09 tentative templates; accuracy, defenses, AI and labels are demo.'
    : u.id === 'rat_brood_mother' ? 'Aaron’s rat brood mother concept: she summons smaller rats. HP, defenses, summon count, cooldown and cap are demo.'
    : 'Aaron’s cultist fighter/caster encounter concepts. “Cultist Zealot” / “Cultist Seer” labels, exact stats and AI implementation are demo.';
  const fields: UnitTemplate['fieldProvenance'] = Object.fromEntries(Object.keys(u).map(k => [k, { owner: 'demo', status: 'demo', why: 'Exact template value/label is a demo implementation choice.' }]));
  if (u.id === 'jubal' || u.id === 'jabal') fields.name = { owner: 'Aaron', status: 'source', why: 'Aaron’s named character.' };
  fields.hp = u.id === 'jubal' ? { owner: 'Drafts/09', status: 'tentative', why: 'JUBAL_HP tentative growth table; not final Aaron numbers.' } : { owner: 'demo', status: 'demo', why };
  const tentative = TENTATIVE_STATS[u.id];
  if (tentative) {
    fields.hp = { owner: 'Drafts/09', status: 'tentative', why: tentative.hp };
    fields.armor = { owner: 'Drafts/09', status: 'tentative', why: tentative.armor };
  }
  if (u.side === 'player') {
    fields.hpGrowth = fields.hp!;
    fields.damageGrowth = { owner: 'Drafts/09', status: 'tentative', why: 'DAMAGE_SCALE tentative level curve; final weapon damage additionally includes demo balance tuning.' };
  }
  return [u.id, { ...u, provenance: { concept: 'source', numbers: u.id === 'jubal' || tentative ? 'tentative' : 'demo', why }, fieldProvenance: fields }];
}));
