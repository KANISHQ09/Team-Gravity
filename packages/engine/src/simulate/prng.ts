/**
 * mulberry32: a tiny, fast, seeded pseudo-random generator. The engine uses
 * it instead of Math.random so the same seed always gives the same mission.
 */
export interface Rng {
  /** Uniform number in [0, 1). */
  next(): number;
  /** True with probability p. */
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, chance: (p) => next() < p };
}
