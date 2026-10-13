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
  wolf: { id: 'wolf', name: 'Wolf', glyph: 'W', side: 'enemy', role: 'Charges the closest target', hp: 80, armorClass: 'light', armor: 50, mr: 10, dodge: 0.2, moveApPerTile: 25 / 3, weapon: 'wolf_bite', ai: 'charger', initiative: 15 },
  cultist_fighter: { id: 'cultist_fighter', name: 'Cultist Zealot', glyph: 'Z', side: 'enemy', role: 'Shield wall for the caster', hp: 130, armorClass: 'light', armor: 75, mr: 30, dodge: 0.08, weapon: 'cultist_blade', ai: 'guardian', initiative: 35 },
  cultist_mage: { id: 'cultist_mage', name: 'Cultist Seer', glyph: 'S', side: 'enemy', role: 'Dazes, brands the ground with fire', hp: 90, armorClass: 'light', armor: 25, mr: 60, dodge: 0.1, weapon: 'cultist_staff', skills: ['daze_bolt', 'hellfire_sigil'], ai: 'caster', initiative: 45 },
  nephilim: {
    id: 'nephilim', name: 'Trapped Nephilim', glyph: 'N', side: 'enemy', role: 'Pinned under the cave-in. One arm free.', hp: 1200, armorClass: 'heavy', armor: 100, mr: 100, dodge: 0, weapon: 'nephilim_arm', skills: ['nephilim_sweep', 'rock_throw', 'rockfall'], ai: 'nephilim',
    footprint: [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
    immobile: true, massive: true, initiative: 40,
  },
};

/** Concepts are Aaron's; these encounter labels and exact stat/AI realizations are not canon. */
export const UNITS: Record<string, UnitTemplate> = Object.fromEntries(Object.values(UNIT_SEEDS).map(u => {
  const why = u.id === 'small_rat' ? 'Aaron’s Granary rat encounter concept; “Granary Rat” label and all combat stats are demo.'
    : u.id === 'jubal' ? 'Aaron’s Jubal character concept. HP and damage growth use Drafts/09 tentative math; initiative and exact demo kit are sandbox choices.'
    : u.id === 'jabal' ? 'Aaron’s Jabal/shepherd companion and club concept. HP curve 150 + 12 × level and exact combat stats are demo.'
    : u.id === 'hired_archer' ? 'Aaron’s hired archer companion concept. HP curve 140 + 10 × level and exact combat stats are demo.'
    : u.id === 'wolf' ? 'Aaron’s wolves/pack encounter concept. Exact HP, movement speed, defenses and AI implementation are demo.'
    : u.id === 'nephilim' ? 'Aaron’s trapped Nephilim encounter concept. Exact HP, footprint, defenses and initiative are demo.'
    : 'Aaron’s cultist fighter/caster encounter concepts. “Cultist Zealot” / “Cultist Seer” labels, exact stats and AI implementation are demo.';
  const fields: UnitTemplate['fieldProvenance'] = Object.fromEntries(Object.keys(u).map(k => [k, { owner: 'demo', status: 'demo', why: 'Exact template value/label is a demo implementation choice.' }]));
  if (u.id === 'jubal' || u.id === 'jabal') fields.name = { owner: 'Aaron', status: 'source', why: 'Aaron’s named character.' };
  fields.hp = u.id === 'jubal' ? { owner: 'Drafts/09', status: 'tentative', why: 'JUBAL_HP tentative growth table; not final Aaron numbers.' } : { owner: 'demo', status: 'demo', why };
  if (u.side === 'player') {
    fields.hpGrowth = fields.hp!;
    fields.damageGrowth = { owner: 'Drafts/09', status: 'tentative', why: 'DAMAGE_SCALE tentative level curve; final weapon damage additionally includes demo balance tuning.' };
  }
  return [u.id, { ...u, provenance: { concept: 'source', numbers: u.id === 'jubal' ? 'tentative' : 'demo', why }, fieldProvenance: fields }];
}));
