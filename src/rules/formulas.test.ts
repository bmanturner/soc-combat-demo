// Golden tests: every worked example in the Sons of Cain design docs.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { damageAfterDefense, effectiveDefense, keepEngagedChance, mitigate, moveCostWithBonus, tilesForBudget, totalAvoidance } from './formulas';

describe('Armor / Magic Resist formula (Combat System → Damage Reduction)', () => {
  it('100 raw vs 100 / 200 / 300 Armor = 50 / 33.33 / 25', () => {
    expect(mitigate(100, 100)).toBe(50);
    expect(mitigate(100, 200)).toBeCloseTo(33.333, 3);
    expect(mitigate(100, 300)).toBe(25);
  });
  it('defense 0 / 50 / 150 / 400 → 100 / 66.7 / 40 / 20 (Tentative Math curve)', () => {
    expect(mitigate(100, 0)).toBe(100);
    expect(mitigate(100, 50)).toBeCloseTo(66.667, 3);
    expect(mitigate(100, 150)).toBe(40);
    expect(mitigate(100, 400)).toBe(20);
  });
});

describe('Penetration (percentage first, then flat)', () => {
  it('20% + 25 flat vs 100 Armor → 55 effective → 100 × 100/155', () => {
    expect(effectiveDefense(100, 0.2, 25)).toBe(55);
    expect(damageAfterDefense(100, 100, 0.2, 25)).toBeCloseTo(64.516, 3);
  });
  it('100 flat pen: vs 100 Armor deals full 100; vs 200 Armor deals 50', () => {
    expect(damageAfterDefense(100, 100, 0, 100)).toBe(100);
    expect(damageAfterDefense(100, 200, 0, 100)).toBe(50);
  });
  it('75% pen: 100 Armor → 25 effective, 200 Armor → 50 effective', () => {
    expect(effectiveDefense(100, 0.75, 0)).toBe(25);
    expect(effectiveDefense(200, 0.75, 0)).toBe(50);
  });
  it('never drops defense below zero', () => {
    expect(effectiveDefense(30, 0, 100)).toBe(0);
  });
});

describe('Defensive reactions stack with diminishing returns', () => {
  it('20% dodge + 10% parry + 0% block = 28% avoidance', () => {
    expect(totalAvoidance([0.2, 0.1, 0])).toBeCloseTo(0.28, 10);
  });
  it('order does not change the total', () => {
    expect(totalAvoidance([0.1, 0.2])).toBeCloseTo(totalAvoidance([0.2, 0.1]), 10);
  });
});

describe('Engagement', () => {
  it('engagement 10 vs disengagement 6 → 60% to keep engaged', () => {
    expect(keepEngagedChance(10, 6, DEFAULT_CONFIG)).toBeCloseTo(0.6, 10);
  });
  it('is clamped to the configured floor and ceiling', () => {
    expect(keepEngagedChance(0, 20, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.engageMin);
    expect(keepEngagedChance(20, 0, DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG.engageMax);
  });
});

describe('Movement AP', () => {
  it('50 AP budget → 5 / 4 / 3 tiles for light / medium / heavy', () => {
    expect(tilesForBudget(10, 50)).toBe(5);
    expect(tilesForBudget(12.5, 50)).toBe(4);
    expect(tilesForBudget(15, 50)).toBe(3);
  });
  it('a 10% movement bonus → 9 / 11.25 / 13.5 AP per tile', () => {
    expect(moveCostWithBonus(10, 0.1)).toBeCloseTo(9, 10);
    expect(moveCostWithBonus(12.5, 0.1)).toBeCloseTo(11.25, 10);
    expect(moveCostWithBonus(15, 0.1)).toBeCloseTo(13.5, 10);
  });
});
