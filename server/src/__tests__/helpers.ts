import { vi } from 'vitest';

/**
 * Tests drive the dice directly. Anything the queue does not cover falls back
 * to a seeded PRNG so the long random-play smoke test stays reproducible.
 */
export const diceQueue: number[] = [];

let seed = 0x2f6e2b1;
export function resetRandom(newSeed = 0x2f6e2b1): void {
  seed = newSeed;
  diceQueue.length = 0;
}

export function nextRandom(): number {
  // xorshift32
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0xffffffff;
}

export function queueDice(...values: number[]): void {
  diceQueue.push(...values);
}

vi.mock('../util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../util')>();
  return {
    ...actual,
    // Deterministic order and deck sequence.
    shuffle: <T>(input: T[]): T[] => [...input],
    rollDie: (): number => {
      const queued = diceQueue.shift();
      if (typeof queued === 'number') return queued;
      return 1 + Math.floor(nextRandom() * 6);
    },
  };
});
