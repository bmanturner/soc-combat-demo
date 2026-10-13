// Grid geometry: directions, distances, line of sight. Pure and deterministic.

export interface Vec {
  x: number;
  y: number;
}

/** Eight directions in clockwise order starting at north. Index matters: patterns rotate through it. */
export const DIRS8: readonly Vec[] = [
  { x: 0, y: -1 }, // 0 N
  { x: 1, y: -1 }, // 1 NE
  { x: 1, y: 0 }, // 2 E
  { x: 1, y: 1 }, // 3 SE
  { x: 0, y: 1 }, // 4 S
  { x: -1, y: 1 }, // 5 SW
  { x: -1, y: 0 }, // 6 W
  { x: -1, y: -1 }, // 7 NW
];

export const DIR_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Indices into DIRS8 for the four cardinal directions. */
export const CARDINAL_IDX = [0, 2, 4, 6] as const;

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const eq = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
export const key = (a: Vec): string => `${a.x},${a.y}`;
export const fromKey = (k: string): Vec => {
  const [x, y] = k.split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0 };
};

/** Chebyshev distance: "tiles away in any direction". */
export const cheb = (a: Vec, b: Vec): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const manhattan = (a: Vec, b: Vec): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Index into DIRS8 for a unit (or straight-line) delta, or -1 if not a straight 8-way line. */
export function dirIndexOf(from: Vec, to: Vec): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return -1;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return -1;
  const ux = sign(dx);
  const uy = sign(dy);
  return DIRS8.findIndex((d) => d.x === ux && d.y === uy);
}

export function dir(i: number): Vec {
  const d = DIRS8[((i % 8) + 8) % 8];
  if (!d) throw new Error(`bad dir ${i}`);
  return d;
}

/** Inclusive Bresenham line from a to b. */
export function line(a: Vec, b: Vec): Vec[] {
  const out: Vec[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

/**
 * Symmetric line of sight: visible if EITHER Bresenham direction is clear of blockers
 * (endpoints excluded). Symmetry matters for readability: if you can shoot them, they can shoot you.
 */
export function hasLineOfSight(a: Vec, b: Vec, blocks: (p: Vec) => boolean): boolean {
  const clear = (path: Vec[]) => path.slice(1, -1).every((p) => !blocks(p));
  return clear(line(a, b)) || clear(line(b, a));
}

/** Distance from a point to the nearest tile of a footprint. */
export function chebToTiles(p: Vec, tiles: readonly Vec[]): number {
  let best = Infinity;
  for (const t of tiles) best = Math.min(best, cheb(p, t));
  return best;
}
