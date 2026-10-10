// Last Modified: 2026-10-10 (v2.0.0.0)
import { RANK_CHARS, SUITS } from './cards.js';

/**
 * Unbiased cryptographically secure random integer in [0, max).
 * Uses rejection sampling to avoid modulo bias.
 * @param {number} max Exclusive upper bound (1..2^32).
 * @returns {number} Random integer.
 */
export function secureRandomInt(max) {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  let value;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/**
 * Create an ordered 52-card deck.
 * @returns {string[]} Card codes.
 */
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANK_CHARS) deck.push(rank + suit);
  }
  return deck;
}

/**
 * Fisher-Yates shuffle returning a new array.
 * @param {string[]} deck Cards to shuffle.
 * @param {(max: number) => number} [randomInt] Random integer source.
 * @returns {string[]} Shuffled copy.
 */
export function shuffle(deck, randomInt = secureRandomInt) {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
