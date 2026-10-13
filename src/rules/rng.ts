// Seeded, serializable PRNG (mulberry32). State is a single uint32 so battles replay exactly.

export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Returns a float in [0, 1) and advances the state. */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Roll against a probability. Returns the roll (0–100 scale for logs) and success. */
export function roll(rng: Rng, chance: number): { roll: number; success: boolean } {
  const r = next(rng);
  return { roll: Math.floor(r * 100), success: r < chance };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  return items[Math.floor(next(rng) * items.length)] as T;
}
