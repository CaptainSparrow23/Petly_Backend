/**
 * Seeded random utilities for deterministic store rotation.
 * Uses MurmurHash3 for hashing and a simple PRNG for shuffling.
 */

/**
 * MurmurHash3 - Fast, non-cryptographic hash function.
 * Produces a 32-bit hash from a string.
 */
export function murmurHash3(str: string, seed: number = 0): number {
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  for (let i = 0; i < str.length; i++) {
    let k1 = str.charCodeAt(i);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  h1 ^= str.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Create a hash from a string (convenience wrapper).
 */
export function hash(input: string): number {
  return murmurHash3(input);
}

/**
 * Mulberry32 - Simple seeded PRNG.
 * Returns a function that generates random numbers between 0 and 1.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle an array deterministically using a seeded RNG.
 * Returns a new shuffled array (does not mutate original).
 */
export function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const rng = createSeededRng(seed);

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate a master seed from userId and weekKey.
 */
export function generateMasterSeed(userId: string, weekKey: string): number {
  return hash(`${userId}:${weekKey}`);
}

/**
 * Generate a category-specific seed from the master seed.
 */
export function generateCategorySeed(masterSeed: number, category: string): number {
  return hash(`${masterSeed}:${category}`);
}

/**
 * Select N items from an array using seeded random.
 * Returns up to `count` items (fewer if array is smaller).
 */
export function seededSelect<T>(array: T[], count: number, seed: number): T[] {
  if (array.length === 0) return [];
  const shuffled = seededShuffle(array, seed);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
