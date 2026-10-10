// Last Modified: 2026-10-10 (v2.0.0.0)
import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';

const CONFIG = { buyIn: 1000, smallBlind: 10, bigBlind: 20, handsPerLevel: 2 };

/**
 * Build a shuffle stub that yields cards in draw order.
 * @param {string[]} drawOrder Cards in the order they will be drawn.
 * @returns {() => string[]} Shuffle replacement.
 */
const stacked = (drawOrder) => () => drawOrder.slice().reverse();

/** Seat n players with ids p0..pn-1 in seats 0..n-1; p0 is host. */
function table(n, options) {
  const game = new Game(CONFIG, 'p0', options);
  for (let i = 0; i < n; i++) game.sit(`p${i}`, `P${i}`, 'emoji:fox', i);
  return game;
}

// Draw order for heads-up with dealer seat 0: seat1, seat0, seat1, seat0, burn, flop x3, burn, turn, burn, river.
const HEADS_UP_DECK = ['Kh', 'As', 'Kd', 'Ac', '5s', '2d', '7c', '9h', '6s', 'Jd', '8s', '3c'];

describe('game flow', () => {
  it('lets only the host deal the first hand and needs two players', () => {
    const game = table(1);
    expect(game.startHand('p0').ok).toBe(false);
    game.sit('p1', 'P1', 'emoji:fox', 1);
    expect(game.startHand('p1').ok).toBe(false);
    expect(game.startHand('p0').ok).toBe(true);
  });

  it('plays a heads-up hand to showdown, pauses, and rotates the dealer', () => {
    const game = table(2, { shuffle: stacked(HEADS_UP_DECK) });
    game.startHand('p0');
    expect(game.dealerSeat).toBe(0);
    expect(game.sbSeat).toBe(0);
    expect(game.toActSeat).toBe(0); // dealer/SB acts first pre-flop
    expect(game.applyAction('p0', { action: 'CALL' }).ok).toBe(true);
    expect(game.applyAction('p1', { action: 'CHECK' }).ok).toBe(true);
    expect(game.phase).toBe('FLOP');
    expect(game.toActSeat).toBe(1); // BB first post-flop
    for (const phase of ['FLOP', 'TURN', 'RIVER']) {
      expect(game.phase).toBe(phase);
      game.applyAction(game.seats[game.toActSeat].id, { action: 'CHECK' });
      game.applyAction(game.seats[game.toActSeat].id, { action: 'CHECK' });
    }
    expect(game.phase).toBe('SHOWDOWN');
    expect(game.toActSeat).toBe(null); // paused: no timer, no turn
    expect(game.seats[0].stack).toBe(1020);
    expect(game.seats[1].stack).toBe(980);
    expect(game.result.winners[0]).toMatchObject({ id: 'p0', amount: 40, handName: 'Pair of Aces' });
    expect(game.nextDealerId).toBe('p1');
    expect(game.startHand('p0').ok).toBe(false);
    expect(game.startHand('p1').ok).toBe(true);
    expect(game.dealerSeat).toBe(1);
  });

  it('awards the pot uncontested when a player folds', () => {
    const game = table(2);
    game.startHand('p0');
    game.applyAction('p0', { action: 'FOLD' });
    expect(game.phase).toBe('SHOWDOWN');
    expect(game.seats[1].stack).toBe(1010);
    expect(game.result.uncontested).toBe(true);
  });

  it('rotates dealer, small and big blind with three players', () => {
    const game = table(3);
    game.startHand('p0');
    expect([game.dealerSeat, game.sbSeat, game.bbSeat]).toEqual([0, 1, 2]);
    expect(game.toActSeat).toBe(0); // UTG is the dealer in a 3-handed game
    game.applyAction('p0', { action: 'FOLD' });
    game.applyAction('p1', { action: 'FOLD' });
    expect(game.nextDealerId).toBe('p1');
    game.startHand('p1');
    expect([game.dealerSeat, game.sbSeat, game.bbSeat]).toEqual([1, 2, 0]);
  });

  it('validates bets and raises', () => {
    const game = table(3);
    game.startHand('p0');
    expect(game.applyAction('p1', { action: 'CALL' }).ok).toBe(false); // not their turn
    expect(game.applyAction('p0', { action: 'CHECK' }).ok).toBe(false); // facing the big blind
    expect(game.applyAction('p0', { action: 'RAISE', amount: 25 }).ok).toBe(false); // below min raise
    expect(game.applyAction('p0', { action: 'RAISE', amount: 5000 }).ok).toBe(false); // more than stack
    expect(game.applyAction('p0', { action: 'RAISE', amount: 1.5 }).ok).toBe(false);
    expect(game.applyAction('p0', { action: 'RAISE', amount: 60 }).ok).toBe(true);
    expect(game.currentBet).toBe(60);
    expect(game.minRaise).toBe(40);
  });

  it('times out to check when free and fold when facing a bet, without removing the player', () => {
    const game = table(2);
    game.startHand('p0');
    game.timeoutAction(); // dealer faces the big blind -> fold
    expect(game.seats[0].folded).toBe(true);
    expect(game.seatOf('p0')).toBe(0);
    const game2 = table(3);
    game2.startHand('p0');
    game2.applyAction('p0', { action: 'CALL' });
    game2.applyAction('p1', { action: 'CALL' });
    game2.timeoutAction(); // BB can check -> check, not fold
    expect(game2.seats[2].folded).toBe(false);
    expect(game2.phase).toBe('FLOP');
  });

  it('handles all-ins with side pots and ends the game with a winner', () => {
    const game = table(3);
    game.seats[0].stack = 100;
    game.seats[1].stack = 300;
    game.seats[2].stack = 300;
    game.startHand('p0');
    game.applyAction('p0', { action: 'ALL_IN' });
    game.applyAction('p1', { action: 'ALL_IN' });
    game.applyAction('p2', { action: 'CALL' });
    expect(game.phase).toBe('SHOWDOWN');
    const total = game.seats.filter(Boolean).reduce((s, p) => s + p.stack, 0);
    expect(total).toBe(700);
    expect(game.result.pots.length).toBe(2);
  });

  it('increases blinds after N hands', () => {
    const game = table(2);
    for (let hand = 1; hand <= 3; hand++) {
      game.startHand(game.nextDealerId);
      if (hand <= 2) expect(game.blinds.bigBlind).toBe(20);
      else expect(game.blinds.bigBlind).toBe(40);
      game.applyAction(game.seats[game.toActSeat].id, { action: 'FOLD' });
    }
  });

  it('folds a leaving player and removes busted players on the next deal', () => {
    const game = table(3);
    game.startHand('p0');
    game.removePlayer('p1');
    expect(game.seats[1].folded).toBe(true);
    game.applyAction('p0', { action: 'FOLD' });
    expect(game.phase).toBe('SHOWDOWN');
    game.startHand(game.nextDealerId);
    expect(game.seatOf('p1')).toBe(-1);
  });
});
