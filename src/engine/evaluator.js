// Last Modified: 2026-10-10 (v2.0.0.0)
import { parseCard } from './cards.js';

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];
const RANK_SINGULAR = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
const RANK_PLURAL = { ...RANK_SINGULAR, 6: 'Sixes' };
for (const r of [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14]) RANK_PLURAL[r] = RANK_SINGULAR[r] + 's';

/**
 * Score exactly five cards. Higher scores (compared lexicographically) win.
 * @param {string[]} cards Five card codes.
 * @returns {number[]} Score: [category, ...tiebreakers].
 */
export function scoreFive(cards) {
  const parsed = cards.map(parseCard);
  const ranks = parsed.map((c) => c.rank).sort((a, b) => b - a);
  const flush = parsed.every((c) => c.suit === parsed[0].suit);
  const unique = [...new Set(ranks)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    else if (unique[0] === 14 && unique[1] === 5) straightHigh = 5; // wheel
  }
  if (straightHigh && flush) return [8, straightHigh];
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const grouped = groups.map((g) => g[0]);
  if (shape === '41') return [7, ...grouped];
  if (shape === '32') return [6, ...grouped];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (shape === '311') return [3, ...grouped];
  if (shape === '221') return [2, ...grouped];
  if (shape === '2111') return [1, ...grouped];
  return [0, ...ranks];
}

/**
 * Compare two scores.
 * @param {number[]} a First score.
 * @param {number[]} b Second score.
 * @returns {number} Positive if a wins, negative if b wins, 0 for a tie.
 */
export function compareScores(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Find the best five-card score from five to seven cards.
 * @param {string[]} cards Card codes (5-7).
 * @returns {number[]} Best score.
 */
export function evaluateHand(cards) {
  if (cards.length < 5 || cards.length > 7) throw new RangeError('Need 5 to 7 cards');
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const score = scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareScores(score, best) > 0) best = score;
          }
        }
      }
    }
  }
  return best;
}

/**
 * Human readable description of a score.
 * @param {number[]} score Score from {@link evaluateHand}.
 * @returns {string} e.g. "Full House, Kings over Tens".
 */
export function describeHand(score) {
  const [category, a, b] = score;
  switch (category) {
    case 8: return a === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_SINGULAR[a]} high`;
    case 7: return `Four of a Kind, ${RANK_PLURAL[a]}`;
    case 6: return `Full House, ${RANK_PLURAL[a]} over ${RANK_PLURAL[b]}`;
    case 5: return `Flush, ${RANK_SINGULAR[a]} high`;
    case 4: return `Straight, ${RANK_SINGULAR[a]} high`;
    case 3: return `Three of a Kind, ${RANK_PLURAL[a]}`;
    case 2: return `Two Pair, ${RANK_PLURAL[a]} and ${RANK_PLURAL[b]}`;
    case 1: return `Pair of ${RANK_PLURAL[a]}`;
    default: return `High Card, ${RANK_SINGULAR[a]}`;
  }
}

export { CATEGORY_NAMES };
