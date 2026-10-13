// Pure combat formulas. Every worked example in the design docs is a test against these.

import type { RulesConfig } from './config';

/** Penetration order (Aaron): percentage first, then flat, never below zero. */
export function effectiveDefense(defense: number, pctPen: number, flatPen: number): number {
  return Math.max(0, defense * (1 - pctPen) - flatPen);
}

/** true damage taken = raw × 100 / (100 + Armor or Magic Resist) */
export function mitigate(raw: number, defense: number): number {
  return (raw * 100) / (100 + Math.max(0, defense));
}

export function damageAfterDefense(raw: number, defense: number, pctPen: number, flatPen: number): number {
  return mitigate(raw, effectiveDefense(defense, pctPen, flatPen));
}

/**
 * Reactions are checked highest-first, each only against the chance the attack still lands,
 * so total avoidance = 1 − Π(1 − c). (20% dodge + 10% parry → 28%.)
 */
export function totalAvoidance(chances: number[]): number {
  return 1 - chances.reduce((acc, c) => acc * (1 - Math.max(0, Math.min(1, c))), 1);
}

/** Chance the engager keeps the mover engaged: base + perPoint × (engagement − disengagement), clamped. */
export function keepEngagedChance(engagement: number, disengagement: number, config: RulesConfig): number {
  const raw = config.engageBase + config.engagePerPoint * (engagement - disengagement);
  return Math.min(config.engageMax, Math.max(config.engageMin, raw));
}

/** Whole tiles a unit can move with a given AP budget. */
export function tilesForBudget(apPerTile: number, budget: number): number {
  return Math.floor(budget / apPerTile + 1e-9);
}

/** Movement speed bonus reduces AP per tile (10% bonus: 10 → 9). */
export function moveCostWithBonus(apPerTile: number, speedBonus: number): number {
  return apPerTile * (1 - speedBonus);
}

/** Escape margin for a delayed effect: >0 means you act before it lands (= 0 depends on tie rule). */
export function escapeMargin(impactAt: number, nextTurnAt: number): number {
  return impactAt - nextTurnAt;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
