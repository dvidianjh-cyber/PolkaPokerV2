// Last Modified: 2026-10-10 (v2.0.0.0)
import { describe, it, expect } from 'vitest';
import { evaluateHand, compareScores, describeHand } from '../src/engine/evaluator.js';
import { buildPots } from '../src/engine/pots.js';
import { createDeck, shuffle } from '../src/engine/deck.js';
import { blindsFor, validateConfig } from '../src/engine/blinds.js';

const hand = (str) => str.split(' ');
const name = (str) => describeHand(evaluateHand(hand(str)));

describe('evaluator', () => {
  it('ranks every category', () => {
    expect(name('As Ks Qs Js Ts 2d 3c')).toBe('Royal Flush');
    expect(name('9h 8h 7h 6h 5h 2d 3c')).toBe('Straight Flush, Nine high');
    expect(name('9h 9s 9d 9c 5h 2d 3c')).toBe('Four of a Kind, Nines');
    expect(name('Kh Ks Kd Tc Th 2d 3c')).toBe('Full House, Kings over Tens');
    expect(name('Ah 8h 7h 6h 2h Kd 3c')).toBe('Flush, Ace high');
    expect(name('9h 8s 7d 6c 5h 2d 2c')).toBe('Straight, Nine high');
    expect(name('Qh Qs Qd 6c 5h 2d 3c')).toBe('Three of a Kind, Queens');
    expect(name('Ah As Kd Kc 5h 2d 3c')).toBe('Two Pair, Aces and Kings');
    expect(name('Ah As 9d 7c 5h 2d 3c')).toBe('Pair of Aces');
    expect(name('Ah Js 9d 7c 5h 2d 3c')).toBe('High Card, Ace');
  });

  it('treats the wheel as a five-high straight', () => {
    expect(name('Ah 2s 3d 4c 5h 9d Kc')).toBe('Straight, Five high');
    expect(compareScores(evaluateHand(hand('Ah 2s 3d 4c 5h')), evaluateHand(hand('2h 3s 4d 5c 6h')))).toBeLessThan(0);
  });

  it('breaks ties with kickers and detects splits', () => {
    const a = evaluateHand(hand('Ah As Kd 7c 5h 2d 3c'));
    const b = evaluateHand(hand('Ad Ac Qd 7s 5s 2h 3d'));
    expect(compareScores(a, b)).toBeGreaterThan(0);
    const c = evaluateHand(hand('Ah As Kd Qc Jh 2d 3c'));
    const d = evaluateHand(hand('Ad Ac Kh Qs Js 2h 3d'));
    expect(compareScores(c, d)).toBe(0);
  });

  it('uses the board when it plays', () => {
    const board = 'Ts Js Qs Ks As';
    expect(compareScores(evaluateHand(hand(`${board} 2d 3c`)), evaluateHand(hand(`${board} 9s 9d`)))).toBe(0);
  });
});

describe('pots', () => {
  it('creates a main pot and side pots for all-ins', () => {
    const pots = buildPots([
      { id: 'a', contributed: 50, folded: false },
      { id: 'b', contributed: 100, folded: false },
      { id: 'c', contributed: 100, folded: false },
      { id: 'd', contributed: 20, folded: true },
    ]);
    expect(pots).toEqual([
      { amount: 170, eligible: ['a', 'b', 'c'] },
      { amount: 100, eligible: ['b', 'c'] },
    ]);
  });

  it('returns uncalled chips as a pot only the bettor can win', () => {
    const pots = buildPots([
      { id: 'a', contributed: 100, folded: false },
      { id: 'b', contributed: 40, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 80, eligible: ['a', 'b'] }, { amount: 60, eligible: ['a'] }]);
  });
});

describe('deck and blinds', () => {
  it('shuffles to a permutation of 52 unique cards', () => {
    const deck = shuffle(createDeck());
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('doubles blinds every N hands', () => {
    const config = { smallBlind: 10, bigBlind: 20, handsPerLevel: 3 };
    expect(blindsFor(config, 3)).toMatchObject({ smallBlind: 10, bigBlind: 20, level: 0 });
    expect(blindsFor(config, 4)).toMatchObject({ smallBlind: 20, bigBlind: 40, level: 1 });
    expect(blindsFor({ ...config, handsPerLevel: 0 }, 99).level).toBe(0);
  });

  it('validates table configuration', () => {
    expect(validateConfig({ buyIn: 1000, smallBlind: 10, bigBlind: 20, handsPerLevel: 5 }).ok).toBe(true);
    expect(validateConfig({ buyIn: -5, smallBlind: 10, bigBlind: 20, handsPerLevel: 5 }).ok).toBe(false);
    expect(validateConfig({ buyIn: 1000, smallBlind: 10.5, bigBlind: 20, handsPerLevel: 5 }).ok).toBe(false);
    expect(validateConfig({ buyIn: 30, smallBlind: 10, bigBlind: 20, handsPerLevel: 5 }).ok).toBe(false);
  });
});
