export type Rng = () => number;

type Weighted<T> = readonly [value: T, weight: number];

/** mulberry32: small, fast, and reproducible across browsers for a 32-bit seed. */
export function createRng(seed: number): Rng {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(rng: Rng, pairs: readonly [Weighted<T>, ...Weighted<T>[]]): T {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let remaining = rng() * total;
  for (const [value, weight] of pairs) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  return pairs[pairs.length - 1]![0];
}

export function countSuccesses(rng: Rng, trials: number, probability: number): number {
  let successes = 0;
  for (let i = 0; i < trials; i++) if (rng() < probability) successes++;
  return successes;
}
