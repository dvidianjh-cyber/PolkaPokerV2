// Last Modified: 2026-10-10 (v2.0.0.0)
import { createDeck, shuffle, secureRandomInt } from './deck.js';
import { evaluateHand, compareScores, describeHand } from './evaluator.js';
import { buildPots } from './pots.js';
import { blindsFor, MAX_SEATS } from './blinds.js';

export { MAX_SEATS };

/** Game phases. The game pauses in SHOWDOWN/LOBBY until the dealer deals. */
export const PHASES = Object.freeze({
  LOBBY: 'LOBBY',
  PREFLOP: 'PREFLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
});

const STREETS = [PHASES.PREFLOP, PHASES.FLOP, PHASES.TURN, PHASES.RIVER];
const BOARD_SIZE = { PREFLOP: 0, FLOP: 3, TURN: 4, RIVER: 5 };

/**
 * Authoritative Texas Hold'em state machine. Contains no DOM or network code.
 * Every public mutator returns `{ok: true}` or `{ok: false, error}`.
 */
export class Game {
  /**
   * @param {{buyIn: number, smallBlind: number, bigBlind: number, handsPerLevel: number}} config Validated table config.
   * @param {string} hostId Player id of the table creator (deals the first hand).
   * @param {{shuffle?: (deck: string[]) => string[]}} [options] Injectable shuffle for tests.
   */
  constructor(config, hostId, options = {}) {
    this.config = { ...config };
    this.hostId = hostId;
    this._shuffle = options.shuffle || ((deck) => shuffle(deck, secureRandomInt));
    this.seats = Array(MAX_SEATS).fill(null);
    this.phase = PHASES.LOBBY;
    this.handNumber = 0;
    this.dealerSeat = null;
    this.sbSeat = null;
    this.bbSeat = null;
    this.nextDealerId = null;
    this.board = [];
    this.deck = [];
    this.currentBet = 0;
    this.minRaise = config.bigBlind;
    this.blinds = blindsFor(config, 1);
    this.toActSeat = null;
    this.result = null;
    this.gameOver = null;
    /** Incremented on every state change that restarts the turn clock. */
    this.actionCount = 0;
  }

  /**
   * Seat index of a player.
   * @param {string} id Player id.
   * @returns {number} Seat index or -1.
   */
  seatOf(id) {
    return this.seats.findIndex((p) => p && p.id === id);
  }

  /**
   * Whether a hand is currently in progress.
   * @returns {boolean} True during betting rounds.
   */
  isBetting() {
    return STREETS.includes(this.phase);
  }

  /**
   * Sit a player at an empty seat with the buy-in stack.
   * @param {string} id Player id.
   * @param {string} name Sanitised display name.
   * @param {string} avatar Avatar token.
   * @param {number} seat Seat index.
   * @returns {{ok: boolean, error?: string}} Result.
   */
  sit(id, name, avatar, seat) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_SEATS) return fail('Invalid seat');
    if (this.seatOf(id) >= 0) return fail('You are already seated');
    if (this.seats[seat]) return fail('That seat is taken');
    if (this.gameOver) return fail('The game is over');
    this.seats[seat] = {
      id, name, avatar, seat, stack: this.config.buyIn, bet: 0, total: 0,
      folded: false, allIn: false, acted: false, inHand: false, left: false, hole: [], handName: null,
    };
    this._computeNextDealer();
    return { ok: true };
  }

  /**
   * Remove a player from the table (folding them if a hand is live).
   * @param {string} id Player id.
   * @returns {{ok: boolean}} Result.
   */
  removePlayer(id) {
    const seat = this.seatOf(id);
    if (seat < 0) return { ok: true };
    const player = this.seats[seat];
    if (this.isBetting() && player.inHand && !player.folded) {
      const wasTurn = this.toActSeat === seat;
      player.folded = true;
      player.left = true;
      if (wasTurn) this.actionCount++;
      if (wasTurn) this._progress(seat);
      else if (this._live().length === 1) this._awardUncontested(this._live()[0]);
    } else if (this.isBetting()) {
      player.left = true;
      if (!player.inHand) this.seats[seat] = null;
    } else {
      this.seats[seat] = null;
      this._computeNextDealer();
    }
    return { ok: true };
  }

  /**
   * Whether the given player may start the next hand right now.
   * @param {string} id Player id.
   * @returns {boolean} True if the deal button is valid for them.
   */
  canDeal(id) {
    return !this.isBetting() && !this.gameOver && id === this.nextDealerId && this._eligible().length >= 2;
  }

  /**
   * Deal a new hand. Only the designated dealer may do this and only while paused.
   * @param {string} requesterId Player id requesting the deal.
   * @returns {{ok: boolean, error?: string}} Result.
   */
  startHand(requesterId) {
    if (this.isBetting()) return fail('A hand is already in progress');
    if (this.gameOver) return fail('The game is over');
    if (requesterId !== this.nextDealerId) return fail('Only the dealer can deal the next hand');
    if (this._eligible().length < 2) return fail('At least two players with chips are needed');

    for (let i = 0; i < MAX_SEATS; i++) {
      const p = this.seats[i];
      if (p && (p.left || p.stack <= 0)) this.seats[i] = null;
    }
    this._computeNextDealer();
    if (requesterId !== this.nextDealerId) return fail('Only the dealer can deal the next hand');

    this.handNumber++;
    this.blinds = blindsFor(this.config, this.handNumber);
    this.result = null;
    this.board = [];
    this.dealerSeat = this.seatOf(requesterId);
    this.deck = this._shuffle(createDeck()).slice();
    for (const p of this.seats) {
      if (!p) continue;
      Object.assign(p, { bet: 0, total: 0, folded: false, allIn: false, acted: false, inHand: true, hole: [], handName: null });
    }
    const order = this._clockwiseFrom(this.dealerSeat);
    for (let round = 0; round < 2; round++) {
      for (const seat of order) this.seats[seat].hole.push(this._draw());
    }
    const headsUp = order.length === 2;
    this.sbSeat = headsUp ? this.dealerSeat : order[0];
    this.bbSeat = headsUp ? order[0] : order[1];
    this._postBlind(this.seats[this.sbSeat], this.blinds.smallBlind);
    this._postBlind(this.seats[this.bbSeat], this.blinds.bigBlind);
    this.currentBet = Math.max(...this.seats.filter(Boolean).map((p) => p.bet));
    this.minRaise = this.blinds.bigBlind;
    this.phase = PHASES.PREFLOP;
    this.actionCount++;
    this._progress(this.bbSeat);
    return { ok: true };
  }

  /**
   * Apply a betting action from the player whose turn it is.
   * @param {string} id Player id.
   * @param {{action: string, amount?: number}} act FOLD | CHECK | CALL | RAISE (amount = total bet for the round) | ALL_IN.
   * @returns {{ok: boolean, error?: string}} Result.
   */
  applyAction(id, act) {
    if (!this.isBetting() || this.toActSeat === null) return fail('No hand is awaiting action');
    const player = this.seats[this.toActSeat];
    if (!player || player.id !== id) return fail('It is not your turn');
    const toCall = this.currentBet - player.bet;
    const maxTo = player.bet + player.stack;
    switch (act.action) {
      case 'FOLD':
        player.folded = true;
        break;
      case 'CHECK':
        if (toCall > 0) return fail('You cannot check while facing a bet');
        break;
      case 'CALL':
        if (toCall <= 0) return fail('There is nothing to call');
        this._pay(player, Math.min(toCall, player.stack));
        break;
      case 'RAISE':
      case 'ALL_IN': {
        const amount = act.action === 'ALL_IN' ? maxTo : act.amount;
        if (!Number.isSafeInteger(amount)) return fail('Raise amount must be a whole number');
        if (amount > maxTo) return fail('You do not have enough chips');
        if (amount <= this.currentBet) {
          if (act.action === 'RAISE') return fail('A raise must exceed the current bet');
          if (toCall <= 0) return fail('Nothing to call');
          this._pay(player, Math.min(toCall, player.stack));
          break;
        }
        if (amount < this.currentBet + this.minRaise && amount < maxTo) {
          return fail(`Minimum raise is to ${this.currentBet + this.minRaise}`);
        }
        const raiseSize = amount - this.currentBet;
        this._pay(player, amount - player.bet);
        if (raiseSize >= this.minRaise) {
          this.minRaise = raiseSize;
          for (const other of this.seats) {
            if (other && other !== player && other.inHand && !other.folded && !other.allIn) other.acted = false;
          }
        }
        this.currentBet = amount;
        break;
      }
      default:
        return fail('Unknown action');
    }
    player.acted = true;
    this.actionCount++;
    this._progress(this.toActSeat);
    return { ok: true };
  }

  /**
   * Enforce the turn timeout: check if free, otherwise fold. The player stays seated.
   * @returns {{ok: boolean, error?: string}} Result.
   */
  timeoutAction() {
    if (!this.isBetting() || this.toActSeat === null) return fail('No hand is awaiting action');
    const player = this.seats[this.toActSeat];
    return this.applyAction(player.id, { action: this.currentBet - player.bet > 0 ? 'FOLD' : 'CHECK' });
  }

  /**
   * Build the view of the state for one participant. Hole cards are hidden
   * except for the viewer and for players revealed at showdown.
   * @param {string|null} forId Viewer player id.
   * @returns {object} JSON-safe state object.
   */
  getView(forId) {
    const revealed = this.result && this.result.revealed ? this.result.revealed : {};
    const toAct = this.toActSeat === null ? null : this.seats[this.toActSeat];
    return {
      youId: forId,
      phase: this.phase,
      handNumber: this.handNumber,
      config: { ...this.config },
      blinds: { ...this.blinds, sbSeat: this.sbSeat, bbSeat: this.bbSeat },
      nextBlinds: blindsFor(this.config, this.handNumber + 1),
      dealerSeat: this.dealerSeat,
      nextDealerId: this.nextDealerId,
      canDeal: forId ? this.canDeal(forId) : false,
      board: this.board.slice(),
      pot: this.seats.reduce((sum, p) => sum + (p ? p.total : 0), 0),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      toActSeat: this.toActSeat,
      toActId: toAct ? toAct.id : null,
      result: this.result ? { ...this.result, revealed: { ...revealed } } : null,
      gameOver: this.gameOver,
      seats: this.seats.map((p) => {
        if (!p) return null;
        const visible = p.id === forId || (revealed[p.id] && !p.folded);
        return {
          id: p.id, name: p.name, avatar: p.avatar, seat: p.seat, stack: p.stack, bet: p.bet,
          folded: p.folded, allIn: p.allIn, inHand: p.inHand,
          holeCount: p.inHand && !p.folded ? p.hole.length : 0,
          hole: visible && p.inHand ? p.hole.slice() : null,
          handName: p.handName,
        };
      }),
    };
  }

  /** @returns {object[]} Players still contesting the hand. @private */
  _live() {
    return this.seats.filter((p) => p && p.inHand && !p.folded);
  }

  /** @returns {object[]} Players able to play the next hand. @private */
  _eligible() {
    return this.seats.filter((p) => p && !p.left && p.stack > 0);
  }

  /**
   * Occupied seats clockwise starting after `from`.
   * @param {number} from Seat index.
   * @returns {number[]} Seat indexes.
   * @private
   */
  _clockwiseFrom(from) {
    const out = [];
    for (let i = 1; i <= MAX_SEATS; i++) {
      const seat = (from + i) % MAX_SEATS;
      if (this.seats[seat] && this.seats[seat].inHand) out.push(seat);
    }
    return out;
  }

  /** @returns {string} Next card from the deck. @private */
  _draw() {
    return this.deck.pop();
  }

  /**
   * Move chips from a player's stack into the pot.
   * @param {object} player Player.
   * @param {number} amount Chips to commit.
   * @private
   */
  _pay(player, amount) {
    const pay = Math.min(amount, player.stack);
    player.stack -= pay;
    player.bet += pay;
    player.total += pay;
    if (player.stack === 0) player.allIn = true;
  }

  /**
   * Post a blind (not counted as an action).
   * @param {object} player Player.
   * @param {number} amount Blind size.
   * @private
   */
  _postBlind(player, amount) {
    this._pay(player, amount);
  }

  /**
   * Next seat clockwise (including `from`, last) that must still act.
   * @param {number} from Seat index.
   * @returns {number|null} Seat or null when the round is complete.
   * @private
   */
  _nextToAct(from) {
    for (let i = 1; i <= MAX_SEATS; i++) {
      const seat = (from + i) % MAX_SEATS;
      const p = this.seats[seat];
      if (p && p.inHand && !p.folded && !p.allIn && (!p.acted || p.bet < this.currentBet)) return seat;
    }
    return null;
  }

  /**
   * Advance the hand after an action: next player, next street or finish.
   * @param {number} from Seat that just acted.
   * @private
   */
  _progress(from) {
    const live = this._live();
    if (live.length === 1) {
      this._awardUncontested(live[0]);
      return;
    }
    const contenders = live.filter((p) => !p.allIn);
    const settled = contenders.length === 0 || (contenders.length === 1 && contenders[0].bet >= this.currentBet);
    const next = settled ? null : this._nextToAct(from);
    if (next !== null) {
      this.toActSeat = next;
      return;
    }
    this._nextStreet();
  }

  /**
   * Close the betting round and deal the next street (or go to showdown).
   * Runs the board out automatically when nobody can bet.
   * @private
   */
  _nextStreet() {
    this.toActSeat = null;
    for (const p of this.seats) {
      if (p) Object.assign(p, { bet: 0, acted: false });
    }
    this.currentBet = 0;
    this.minRaise = this.blinds.bigBlind;
    const index = STREETS.indexOf(this.phase);
    if (index === STREETS.length - 1) {
      this._showdown();
      return;
    }
    this.phase = STREETS[index + 1];
    this._draw(); // burn
    while (this.board.length < BOARD_SIZE[this.phase]) this.board.push(this._draw());
    this.actionCount++;
    const canAct = this._live().filter((p) => !p.allIn);
    if (canAct.length < 2) {
      this._nextStreet();
      return;
    }
    this.toActSeat = this._nextToAct(this.dealerSeat);
  }

  /**
   * Award the pot when everyone else has folded.
   * @param {object} winner Remaining player.
   * @private
   */
  _awardUncontested(winner) {
    const amount = this.seats.reduce((sum, p) => sum + (p ? p.total : 0), 0);
    winner.stack += amount;
    this.result = {
      uncontested: true,
      pots: [{ amount, winnerIds: [winner.id], handName: null }],
      payouts: { [winner.id]: amount },
      winners: [{ id: winner.id, amount, handName: null }],
      revealed: {},
    };
    this._finishHand();
  }

  /**
   * Evaluate hands, split main and side pots, and pay winners.
   * @private
   */
  _showdown() {
    const live = this._live();
    const scores = {};
    const revealed = {};
    for (const p of live) {
      scores[p.id] = evaluateHand([...p.hole, ...this.board]);
      p.handName = describeHand(scores[p.id]);
      revealed[p.id] = p.hole.slice();
    }
    const pots = buildPots(this.seats.filter(Boolean).filter((p) => p.total > 0)
      .map((p) => ({ id: p.id, contributed: p.total, folded: p.folded || !p.inHand })));
    const payouts = {};
    const resultPots = [];
    for (const pot of pots) {
      const eligible = live.filter((p) => pot.eligible.includes(p.id));
      let best = null;
      for (const p of eligible) if (!best || compareScores(scores[p.id], best) > 0) best = scores[p.id];
      const winners = eligible
        .filter((p) => compareScores(scores[p.id], best) === 0)
        .sort((a, b) => ((a.seat - this.dealerSeat + MAX_SEATS) % MAX_SEATS) - ((b.seat - this.dealerSeat + MAX_SEATS) % MAX_SEATS));
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const w of winners) {
        const award = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        w.stack += award;
        payouts[w.id] = (payouts[w.id] || 0) + award;
      }
      resultPots.push({ amount: pot.amount, winnerIds: winners.map((w) => w.id), handName: winners[0].handName });
    }
    const winnersList = Object.entries(payouts).map(([id, amount]) => ({
      id, amount, handName: this.seats[this.seatOf(id)].handName,
    }));
    this.result = { uncontested: false, pots: resultPots, payouts, winners: winnersList, revealed };
    this._finishHand();
  }

  /**
   * End the hand: pause in SHOWDOWN and designate the next dealer.
   * @private
   */
  _finishHand() {
    this.phase = PHASES.SHOWDOWN;
    this.toActSeat = null;
    this.actionCount++;
    this._computeNextDealer();
    const alive = this._eligible();
    if (alive.length < 2) {
      this.gameOver = alive.length === 1 ? alive[0].id : 'none';
      this.nextDealerId = null;
    }
  }

  /**
   * Work out who deals next. Before the first hand: the host. Afterwards the
   * next player with chips clockwise from the previous dealer.
   * @private
   */
  _computeNextDealer() {
    const ok = (p) => p && !p.left && p.stack > 0;
    this.nextDealerId = null;
    if (this.dealerSeat === null) {
      const hostSeat = this.seatOf(this.hostId);
      if (hostSeat >= 0 && ok(this.seats[hostSeat])) {
        this.nextDealerId = this.hostId;
        return;
      }
      const first = this.seats.find(ok);
      this.nextDealerId = first ? first.id : null;
      return;
    }
    for (let i = 1; i <= MAX_SEATS; i++) {
      const p = this.seats[(this.dealerSeat + i) % MAX_SEATS];
      if (ok(p)) {
        this.nextDealerId = p.id;
        return;
      }
    }
  }
}

/**
 * Build a failure result.
 * @param {string} error Message.
 * @returns {{ok: false, error: string}} Failure.
 */
function fail(error) {
  return { ok: false, error };
}
