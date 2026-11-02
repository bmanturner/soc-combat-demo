// How an attack or skill shows on a figure, by its rules name: shared by the procedural and generated figures.

import { SKILLS, WEAPONS } from '../content/gear';

/** Attack and skill names that send something flying: `shot` skills and ranged weapon modes (javelin throw, bows). */
const RANGED_ATTACKS = new Set([
  ...Object.values(SKILLS).filter((s) => s.kind === 'shot').map((s) => s.name),
  ...Object.values(WEAPONS).flatMap((w) => w.modes.filter((m) => m.ranged).map((m) => m.name)),
]);
/** Delayed area effects: cast on the ground, nothing flies. */
const AREA_EFFECTS = new Set(Object.values(SKILLS).filter((s) => s.kind === 'sigil').map((s) => s.name));

export const isRangedAttack = (name: string): boolean => RANGED_ATTACKS.has(name);
export const isAreaEffect = (name: string): boolean => AREA_EFFECTS.has(name);
