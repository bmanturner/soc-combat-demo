// Weapon tile patterns. Melee patterns are chosen by direction; the "anchor" is the clicked tile.

import { CARDINAL_IDX, add, cheb, dir, dirIndexOf, scale, type Vec } from './geometry';
import type { PatternKind } from './types';

export interface PatternTile {
  tile: Vec;
  /** 0 = primary tile, 1 = near side tile, 2 = far side tile (two-handed accuracy penalties). */
  ring: 0 | 1 | 2;
}

/** Direction indices this pattern can be aimed at. */
export function patternDirections(kind: PatternKind): number[] {
  if (kind === 'cardinal') return [...CARDINAL_IDX];
  return [0, 1, 2, 3, 4, 5, 6, 7];
}

/** Tiles hit when a melee pattern is aimed in direction i. */
export function patternTiles(kind: PatternKind, origin: Vec, i: number): PatternTile[] {
  switch (kind) {
    case 'cardinal':
    case 'adjacent':
      return [{ tile: add(origin, dir(i)), ring: 0 }];
    case 'pairCw':
      return [
        { tile: add(origin, dir(i)), ring: 0 },
        { tile: add(origin, dir(i + 1)), ring: 0 },
      ];
    case 'line2':
      return [
        { tile: add(origin, dir(i)), ring: 0 },
        { tile: add(origin, scale(dir(i), 2)), ring: 0 },
      ];
    case 'arc5':
      return [
        { tile: add(origin, dir(i - 2)), ring: 2 },
        { tile: add(origin, dir(i - 1)), ring: 1 },
        { tile: add(origin, dir(i)), ring: 0 },
        { tile: add(origin, dir(i + 1)), ring: 1 },
        { tile: add(origin, dir(i + 2)), ring: 2 },
      ];
    case 'ranged':
      return [];
  }
}

/**
 * Resolve which direction a clicked tile means for a melee pattern, or null if it can't be aimed there.
 * Polearms accept a click on either tile of the line.
 */
export function aimDirection(kind: PatternKind, origin: Vec, target: Vec): number | null {
  const d = cheb(origin, target);
  const i = dirIndexOf(origin, target);
  if (i < 0) return null;
  if (kind === 'line2') return d <= 2 ? i : null;
  if (d !== 1) return null;
  if (kind === 'cardinal' && i % 2 !== 0) return null;
  return i;
}
