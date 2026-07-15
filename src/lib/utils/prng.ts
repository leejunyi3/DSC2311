/**
 * Seeded, deterministic pseudo-random generator (§33.4). Demo and fixture code
 * MUST use this driven by `DEMO_SEED` — never `Math.random()` — so the
 * dashboard, map, charts, alerts and chatbot stay consistent across renders.
 */

/** mulberry32 — small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn an arbitrary string (scenario id + field) into a 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small deterministic RNG facade with helpers used by the demo provider. */
export class SeededRng {
  private readonly next: () => number;

  constructor(seed: number | string) {
    const s = typeof seed === "string" ? hashSeed(seed) : seed;
    this.next = mulberry32(s);
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element deterministically. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() on empty array");
    return items[this.int(0, items.length - 1)] as T;
  }
}
