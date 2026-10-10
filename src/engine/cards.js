// Last Modified: 2026-10-10 (v2.0.0.0)

/** Card ranks as characters, index + 2 = numeric rank (2..14). */
export const RANK_CHARS = '23456789TJQKA';
/** Suit codes: spades, hearts, diamonds, clubs. */
export const SUITS = ['s', 'h', 'd', 'c'];
/** Pattern every card code must match, e.g. "As", "Td". */
export const CARD_PATTERN = /^[2-9TJQKA][shdc]$/;

/**
 * Parse a two-character card code into numeric rank and suit.
 * @param {string} code Card code such as "Kh".
 * @returns {{rank: number, suit: string}} Parsed card.
 */
export function parseCard(code) {
  return { rank: RANK_CHARS.indexOf(code[0]) + 2, suit: code[1] };
}

/**
 * Build a card code from rank and suit.
 * @param {number} rank Numeric rank 2..14.
 * @param {string} suit Suit code.
 * @returns {string} Card code.
 */
export function makeCard(rank, suit) {
  return RANK_CHARS[rank - 2] + suit;
}
