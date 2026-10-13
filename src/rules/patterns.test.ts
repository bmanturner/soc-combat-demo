import { describe, expect, it } from 'vitest';
import { key, type Vec } from './geometry';
import { patternTiles } from './patterns';

const O = { x: 5, y: 5 };
const tiles = (k: Parameters<typeof patternTiles>[0], i: number) => patternTiles(k, O, i).map((t) => key(t.tile)).sort();
const keys = (vs: Vec[]) => vs.map(key).sort();

describe('Weapon patterns (Weapons note)', () => {
  it('one-handed + shield attacking north also hits northeast', () => {
    expect(tiles('pairCw', 0)).toEqual(keys([{ x: 5, y: 4 }, { x: 6, y: 4 }]));
  });
  it('two-handed attacking north hits NW, N, NE, W and E', () => {
    expect(tiles('arc5', 0)).toEqual(keys([{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 4, y: 5 }, { x: 6, y: 5 }]));
  });
  it('two-handed side tiles carry accuracy rings 1 (near) and 2 (far)', () => {
    const rings = Object.fromEntries(patternTiles('arc5', O, 0).map((t) => [key(t.tile), t.ring]));
    expect(rings['5,4']).toBe(0);
    expect(rings['4,4']).toBe(1);
    expect(rings['6,4']).toBe(1);
    expect(rings['4,5']).toBe(2);
    expect(rings['6,5']).toBe(2);
  });
  it('polearm hits a two-tile straight line, including diagonals', () => {
    expect(tiles('line2', 0)).toEqual(keys([{ x: 5, y: 4 }, { x: 5, y: 3 }]));
    expect(tiles('line2', 3)).toEqual(keys([{ x: 6, y: 6 }, { x: 7, y: 7 }]));
  });
  it('daggers hit a single cardinal tile', () => {
    expect(tiles('cardinal', 2)).toEqual(keys([{ x: 6, y: 5 }]));
  });
});
