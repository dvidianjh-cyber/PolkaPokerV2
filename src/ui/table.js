// Last Modified: 2026-10-10 (v2.0.0.1)
import { h, chip, fmt } from './dom.js';
import { cardElement } from './cards.js';
import { avatarGlyph, AVATARS, DEFAULT_AVATAR } from '../shared/avatars.js';
import { MSG, sanitizeName, MAX_NAME_LENGTH } from '../net/messages.js';
import { MAX_SEATS } from '../engine/blinds.js';
import { loadProfile, saveProfile } from '../storage/profile.js';

const URGENT_MS = 10000;

/**
 * Renders the table from the Host's state object (single source of truth)
 * and turns user input into intents sent through the session. Contains no
 * game rules: all validation happens on the Host.
 */
export class TableView {
  /**
   * @param {HTMLElement} root Mount element.
   * @param {object} options Options.
   * @param {{send: Function}} options.session Host or client session.
   * @param {string} options.code Join code.
   * @param {boolean} options.isHost Whether the local player is the host.
   * @param {{fourColour: boolean}} options.prefs Display preferences.
   * @param {() => void} options.onLeave Called when the user leaves.
   * @param {(prefs: {fourColour: boolean}) => void} options.onPrefsChange Called when preferences change.
   */
  constructor(root, { session, code, isHost, prefs, onLeave, onPrefsChange }) {
    this.root = root;
    this.session = session;
    this.code = code;
    this.isHost = isHost;
    this.prefs = prefs;
    this.onLeave = onLeave;
    this.onPrefsChange = onPrefsChange;
    this.state = null;
    this.deadline = null;
    this.names = new Map();
    this.raiseTo = null;
    this.raiseKey = null;
    this.raiseRefs = null;
    this.toastText = '';
    this.toastTimer = null;
    this.onboardingSeat = null;
    this.onboardingError = '';
    this.tickTimer = setInterval(this._onTick, 250);
  }

  /**
   * Receive a new state from the Host and re-render.
   * @param {object} state State view.
   */
  update(state) {
    this.state = state;
    this.deadline = state.turnMsRemaining != null ? Date.now() + state.turnMsRemaining : null;
    for (const p of state.seats) if (p) this.names.set(p.id, p.name);
    this._render();
    this._onTick();
  }

  /**
   * Show a transient message (errors from the Host, confirmations).
   * @param {string} message Text.
   */
  toast(message) {
    if (this.onboardingSeat !== null && message) {
      this.onboardingError = message;
      this._render();
      return;
    }
    this.toastText = message;
    const el = this.root.querySelector('.toast');
    if (el) {
      el.textContent = message;
      el.classList.add('toast--show');
    }
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(this._onToastExpire, 4500);
  }

  /** Stop timers and clear the screen. */
  destroy() {
    clearInterval(this.tickTimer);
    clearTimeout(this.toastTimer);
    this.root.replaceChildren();
  }

  /** Hide the toast after its timeout. */
  _onToastExpire = () => {
    this.toastText = '';
    const el = this.root.querySelector('.toast');
    if (el) {
      el.textContent = '';
      el.classList.remove('toast--show');
    }
  };

  /** Update the countdown ring of the active player. */
  _onTick = () => {
    if (!this.state) return;
    const ring = this.root.querySelector('.avatar-ring[data-active="true"]');
    if (!ring || this.deadline === null) return;
    const remaining = Math.max(0, this.deadline - Date.now());
    ring.style.setProperty('--pct', ((remaining / this.state.turnMs) * 100).toFixed(1));
    ring.dataset.urgent = String(remaining < URGENT_MS);
    const label = ring.querySelector('.ring-seconds');
    if (label) label.textContent = String(Math.ceil(remaining / 1000));
  };

  /** @returns {object|null} The local player's seat data. */
  _me() {
    return this.state.seats.find((p) => p && p.id === this.state.youId) || null;
  }

  /**
   * Display name for a player id (remembers players who have left).
   * @param {string} id Player id.
   * @returns {string} Name.
   */
  _nameOf(id) {
    return this.names.get(id) || 'A player';
  }

  /** Rebuild the whole screen from state. */
  _render() {
    const me = this._me();
    this.raiseRefs = null;
    this.root.replaceChildren(
      h('main', { class: 'table-screen' },
        this._buildHeader(),
        this._buildTable(me),
        this.onboardingSeat !== null ? this._buildOnboardingModal() : null,
        h('div', { class: `toast${this.toastText ? ' toast--show' : ''}`, role: 'status', 'aria-live': 'polite', text: this.toastText })));
  }

  /** @returns {HTMLElement} Header with code, blinds and settings. */
  _buildHeader() {
    const s = this.state;
    const blinds = s.blinds;
    const rising = s.config.handsPerLevel > 0
      ? ` \u00B7 doubles every ${s.config.handsPerLevel} hand${s.config.handsPerLevel === 1 ? '' : 's'}` : '';
    const upcoming = s.phase !== 'LOBBY' && s.nextBlinds.level !== s.blinds.level && s.phase === 'SHOWDOWN'
      ? ` \u00B7 next hand ${fmt(s.nextBlinds.smallBlind)}/${fmt(s.nextBlinds.bigBlind)}` : '';
    return h('header', { class: 'table-header' },
      h('div', { class: 'code-box' },
        h('span', { class: 'code-label', text: 'Table code' }),
        h('strong', { class: 'code-value', id: 'table-code', text: this.code }),
        h('button', { type: 'button', class: 'btn btn-small', id: 'btn-copy', text: 'Copy', onClick: this._onCopy })),
      h('p', { class: 'blinds-info', text: `Blinds ${fmt(s.blinds.smallBlind)}/${fmt(blinds.bigBlind)}${rising}${upcoming}` }),
      h('div', { class: 'header-actions' },
        h('button', {
          type: 'button', class: 'btn btn-small', id: 'btn-palette', 'aria-pressed': String(this.prefs.fourColour),
          text: this.prefs.fourColour ? '4-colour: on' : '4-colour: off', onClick: this._onTogglePalette,
        }),
        h('button', { type: 'button', class: 'btn btn-small btn-danger', id: 'btn-leave', text: this.isHost ? 'End game' : 'Leave', onClick: this._onLeaveClick })));
  }

  /** Copy the join code to the clipboard. */
  _onCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.code).then(
        () => this.toast('Code copied'),
        () => this.toast(`Code: ${this.code}`),
      );
    } else {
      this.toast(`Code: ${this.code}`);
    }
  };

  /** Switch between two-colour and four-colour decks. */
  _onTogglePalette = () => {
    this.prefs = { ...this.prefs, fourColour: !this.prefs.fourColour };
    this.onPrefsChange(this.prefs);
    this._render();
  };

  /** Confirm and leave the table. */
  _onLeaveClick = () => {
    const message = this.isHost ? 'Ending the game will disconnect everyone. Continue?' : 'Leave this table?';
    if (window.confirm(message)) this.onLeave();
  };

  /**
   * Build the felt with eight radially arranged seats and the board.
   * @param {object|null} me Local player.
   * @returns {HTMLElement} Table section.
   */
  _buildTable(me) {
    const base = me ? me.seat : 0;
    const cells = [];
    for (let position = 0; position < MAX_SEATS; position++) {
      const seat = (base + position) % MAX_SEATS;
      cells.push(this._buildSeat(this.state.seats[seat], seat, position, me));
    }
    cells.push(this._buildBoard());
    return h('section', { class: 'table-felt', 'aria-label': 'Poker table' }, h('div', { class: 'table-grid' }, cells));
  }

  /**
   * Build one seat.
   * @param {object|null} player Seat occupant.
   * @param {number} seat Seat index.
   * @param {number} position Visual position (0 = bottom, clockwise).
   * @param {object|null} me Local player.
   * @returns {HTMLElement} Seat element.
   */
  _buildSeat(player, seat, position, me) {
    const s = this.state;
    if (!player) {
      const canSit = !me && !s.gameOver;
      return h('div', { class: `seat seat--empty pos-${position}` },
        canSit
          ? h('button', { type: 'button', class: 'btn btn-sit', 'aria-label': `Sit here, seat ${seat + 1}`, text: 'Sit Here', onClick: this._makeSitHandler(seat) })
          : h('span', { class: 'seat-empty-label', text: 'Empty' }));
    }
    const isTurn = s.toActSeat === seat;
    const payout = s.result && s.result.payouts ? s.result.payouts[player.id] : 0;
    const classes = ['seat', `pos-${position}`];
    if (player.id === s.youId) classes.push('seat--me');
    if (isTurn) classes.push('seat--turn');
    if (player.folded || (!player.inHand && s.phase !== 'LOBBY' && s.phase !== 'SHOWDOWN')) classes.push('seat--folded');
    if (payout) classes.push('seat--winner');

    const markers = [];
    if (s.handNumber > 0 && s.dealerSeat === seat) markers.push(h('span', { class: 'marker marker--dealer', title: 'Dealer', text: 'D' }));
    if (s.handNumber > 0 && s.blinds.sbSeat === seat) markers.push(h('span', { class: 'marker', title: 'Small blind', text: 'SB' }));
    if (s.handNumber > 0 && s.blinds.bbSeat === seat) markers.push(h('span', { class: 'marker', title: 'Big blind', text: 'BB' }));

    let cards = null;
    if (player.id !== s.youId) {
      if (player.hole) cards = player.hole.map((c) => cardElement(c, { fourColour: this.prefs.fourColour, size: 'mini' }));
      else if (player.holeCount) cards = Array.from({ length: player.holeCount }, () => cardElement(null, { size: 'mini' }));
    }
    let status = '';
    if (payout) status = `Wins ${fmt(payout)}`;
    else if (player.folded) status = 'Folded';
    else if (player.allIn) status = 'All-in';
    else if (!player.inHand && s.phase !== 'LOBBY' && s.phase !== 'SHOWDOWN') status = 'Next hand';

    const isMe = player.id === s.youId;
    const identity = [
      h('div', { class: 'avatar-ring', dataset: { active: String(isTurn), urgent: 'false' }, style: '--pct: 100' },
        h('span', { class: 'avatar', 'aria-hidden': 'true', text: avatarGlyph(player.avatar) }),
        isTurn ? h('span', { class: 'ring-seconds', 'aria-hidden': 'true' }) : null,
        markers.length ? h('span', { class: 'markers' }, markers) : null),
      h('span', { class: 'seat-name', text: player.name }),
      chip(player.stack, 'chip--stack'),
      status ? h('span', { class: 'seat-status', text: status }) : null,
      player.bet > 0 ? h('span', { class: 'seat-bet' }, chip(player.bet, 'chip--bet')) : null,
    ];
    const label = `${player.name}, ${fmt(player.stack)} chips`;
    if (isMe) {
      classes.push('seat--hero');
      return h('div', { class: classes.join(' '), 'aria-label': label },
        h('div', { class: 'hero-main' },
          h('div', { class: 'hero-id' }, identity),
          this._buildHand(player)),
        this._buildControls(player));
    }
    return h('div', { class: classes.join(' '), 'aria-label': label },
      cards ? h('div', { class: 'seat-cards' }, cards) : null,
      identity);
  }

  /**
   * Create a click handler that sits the local player at a seat.
   * @param {number} seat Seat index.
   * @returns {() => void} Handler.
   */
  _makeSitHandler(seat) {
    return function onSitClick() {
      this.onboardingSeat = seat;
      this.onboardingError = '';
      this._render();
    }.bind(this);
  }

  /** Build the seat claiming modal. @returns {HTMLElement} Modal. */
  _buildOnboardingModal() {
    const profile = loadProfile() || {};
    let avatar = profile.avatarUrl || DEFAULT_AVATAR;

    const nameInput = h('input', {
      type: 'text', maxlength: MAX_NAME_LENGTH, autocomplete: 'nickname',
      value: profile.playerName || '', placeholder: 'Your name', required: true,
    });
    const errorBox = h('p', { class: 'form-error', role: 'alert', text: this.onboardingError });
    const avatarButtons = [];

    const selectAvatar = (token) => {
      avatar = token;
      for (const btn of avatarButtons) btn.setAttribute('aria-checked', String(btn.dataset.avatar === token));
    };

    for (const a of AVATARS) {
      const token = `emoji:${a.id}`;
      avatarButtons.push(h('button', {
        type: 'button', class: 'avatar-option', role: 'radio', 'aria-label': a.id,
        'aria-checked': String(token === avatar), dataset: { avatar: token }, text: a.glyph,
        onClick: (e) => selectAvatar(e.currentTarget.dataset.avatar),
      }));
    }

    const onSubmit = (event) => {
      event.preventDefault();
      const name = sanitizeName(nameInput.value);
      if (!name) {
        this.onboardingError = 'Please enter a name first.';
        this._render();
        return;
      }
      saveProfile({ playerName: name, avatarUrl: avatar });
      this.session.send(MSG.JOIN, { name, avatar });
      this.session.send(MSG.SIT, { seat: this.onboardingSeat });
      this.onboardingSeat = null;
    };

    const onCancel = () => {
      this.onboardingSeat = null;
      this._render();
    };

    return h('div', { class: 'modal-overlay' },
      h('form', { class: 'panel modal-content', onSubmit },
        h('h2', { text: `Claim Seat ${this.onboardingSeat + 1}` }),
        h('label', { text: 'Name (max 12 characters)' }), nameInput,
        h('div', { class: 'avatar-picker', role: 'radiogroup', 'aria-label': 'Choose an avatar' }, avatarButtons),
        errorBox,
        h('div', { class: 'landing-actions' },
          h('button', { type: 'button', class: 'btn btn-small', text: 'Cancel', onClick: onCancel }),
          h('button', { type: 'submit', class: 'btn btn-primary', text: 'Join Seat' })
        )
      )
    );
  }

  /** @returns {HTMLElement} Centre of the table: pot, board and status. */
  _buildBoard() {
    const s = this.state;
    const slots = [];
    for (let i = 0; i < 5; i++) {
      slots.push(s.board[i] ? cardElement(s.board[i], { fourColour: this.prefs.fourColour, size: 'board' }) : h('span', { class: 'card-slot' }));
    }
    return h('div', { class: 'board-area' },
      s.pot > 0 ? h('div', { class: 'pot' }, chip(s.pot, 'chip--pot'), h('span', { class: 'pot-label', text: 'Pot' })) : null,
      h('div', { class: 'board-cards', role: 'group', 'aria-label': 'Community cards' }, slots),
      this._buildStatus());
  }

  /** @returns {HTMLElement} Status text, showdown summary and the deal button. */
  _buildStatus() {
    const s = this.state;
    const lines = [];
    let headline = '';
    if (s.phase === 'LOBBY') {
      const seated = s.seats.filter(Boolean).length;
      headline = seated < 2 ? `Waiting for players to join (${seated}/${MAX_SEATS}). Share the code!` : `${seated} players seated.`;
    } else if (s.phase === 'SHOWDOWN' && s.result) {
      headline = s.result.uncontested ? 'Everyone else folded' : 'Showdown';
      for (const w of s.result.winners) {
        lines.push(h('p', { class: 'result-line' },
          h('strong', { text: this._nameOf(w.id) }), ` wins ${fmt(w.amount)}`, w.handName ? ` with ${w.handName}` : ''));
      }
      if (s.result.pots.length > 1) {
        s.result.pots.forEach((pot, i) => {
          lines.push(h('p', { class: 'result-side', text: `${i === 0 ? 'Main pot' : `Side pot ${i}`} ${fmt(pot.amount)}: ${pot.winnerIds.map((id) => this._nameOf(id)).join(', ')}` }));
        });
      }
    } else if (s.toActId) {
      headline = s.toActId === s.youId ? 'Your turn' : `Waiting for ${this._nameOf(s.toActId)}`;
    }
    if (s.gameOver) {
      lines.push(h('p', { class: 'result-line result-final', text: s.gameOver === 'none' ? 'Game over' : `Game over: ${this._nameOf(s.gameOver)} wins the table!` }));
    }
    if (!this._me() && !s.gameOver) lines.push(h('p', { class: 'result-side', text: 'You are watching. Take an empty seat to play.' }));

    let action = null;
    if (s.canDeal) {
      action = h('button', { type: 'button', class: 'btn btn-deal', id: 'btn-deal', text: s.handNumber === 0 ? 'Deal first hand' : 'Deal next hand', onClick: this._onDeal });
    } else if (!s.gameOver && (s.phase === 'LOBBY' || s.phase === 'SHOWDOWN') && s.nextDealerId && s.seats.filter(Boolean).length >= 2) {
      lines.push(h('p', { class: 'result-side', text: `Waiting for ${this._nameOf(s.nextDealerId)} to deal${s.handNumber ? ' the next hand' : ''}...` }));
    }
    return h('div', { class: 'status', 'aria-live': 'polite' }, h('p', { class: 'status-headline', text: headline }), lines, action);
  }

  /** Ask the Host to deal. */
  _onDeal = () => {
    this.session.send(MSG.DEAL_HAND);
  };

  /**
   * Build the local player's oversized hole cards (rendered beside their avatar).
   * @param {object} me Local player.
   * @returns {HTMLElement} Hand container.
   */
  _buildHand(me) {
    const s = this.state;
    if (me.hole && me.inHand) {
      return h('div', { class: `my-hand${me.folded ? ' my-hand--folded' : ''}`, role: 'group', 'aria-label': 'Your hole cards' },
        me.hole.map((c) => cardElement(c, { fourColour: this.prefs.fourColour, size: 'hand' })),
        me.folded ? h('span', { class: 'my-hand-note', text: 'Folded' }) : null,
        me.handName && s.phase === 'SHOWDOWN' && !me.folded ? h('span', { class: 'my-hand-note', text: me.handName }) : null);
    }
    return h('div', { class: 'my-hand my-hand--note', text: s.phase === 'LOBBY' || s.phase === 'SHOWDOWN' ? 'Waiting for the next deal.' : 'You will be dealt in next hand.' });
  }

  /**
   * Build action controls for the local player's turn: Fold / Call or Check /
   * Raise, with the raise sizing panel opened in place of the buttons.
   * @param {object} me Local player.
   * @returns {HTMLElement|null} Controls, or null when it is not their turn.
   */
  _buildControls(me) {
    const s = this.state;
    if (s.toActId !== s.youId) return null;
    const toCall = s.currentBet - me.bet;
    const maxTo = me.bet + me.stack;
    const minTo = Math.min(s.currentBet + s.minRaise, maxTo);
    const canRaise = maxTo > s.currentBet;

    const key = [s.handNumber, s.phase, s.currentBet, s.toActId].join(':');
    if (key !== this.raiseKey || this.raiseTo === null) {
      this.raiseKey = key;
      this.raiseTo = minTo;
      this.raiseOpen = false;
    }
    this.raiseTo = Math.min(maxTo, Math.max(minTo, this.raiseTo));

    if (canRaise && this.raiseOpen) return this._buildRaisePanel(s, me, { toCall, minTo, maxTo });

    const raiseLabel = minTo >= maxTo ? `All-in ${fmt(maxTo)}` : s.currentBet === 0 ? 'Bet' : 'Raise';
    const buttons = [
      h('button', { type: 'button', class: 'btn btn-fold', id: 'btn-fold', text: 'Fold', onClick: this._onFold }),
      toCall > 0
        ? h('button', { type: 'button', class: 'btn btn-call', id: 'btn-call', text: toCall >= me.stack ? `All-in ${fmt(me.stack)}` : `Call ${fmt(toCall)}`, onClick: this._onCall })
        : h('button', { type: 'button', class: 'btn btn-call', id: 'btn-check', text: 'Check', onClick: this._onCheck }),
    ];
    if (canRaise) {
      this.raiseRefs = { minTo, maxTo, currentBet: s.currentBet };
      buttons.push(h('button', {
        type: 'button', class: 'btn btn-raise', id: 'btn-raise-open', text: raiseLabel,
        onClick: minTo >= maxTo ? this._onRaise : this._onRaiseOpen,
      }));
    }
    return h('div', { class: 'controls', role: 'group', 'aria-label': 'Your actions' }, h('div', { class: 'controls-main' }, buttons));
  }

  /**
   * Build the raise sizing panel.
   * @param {object} s State.
   * @param {object} me Local player.
   * @param {{toCall: number, minTo: number, maxTo: number}} range Sizing bounds.
   * @returns {HTMLElement} Controls element.
   */
  _buildRaisePanel(s, me, { toCall, minTo, maxTo }) {
    const slider = h('input', { type: 'range', id: 'raise-slider', min: minTo, max: maxTo, step: 1, value: this.raiseTo, 'aria-label': 'Raise amount', onInput: this._onRaiseInput });
    const number = h('input', { type: 'number', id: 'raise-number', min: minTo, max: maxTo, step: 1, value: this.raiseTo, inputmode: 'numeric', 'aria-label': 'Raise to', onChange: this._onRaiseInput });
    const confirm = h('button', { type: 'button', class: 'btn btn-raise', id: 'btn-raise', onClick: this._onRaise });
    this.raiseRefs = { slider, number, confirm, minTo, maxTo, currentBet: s.currentBet };
    const potSize = s.currentBet + s.pot + toCall;
    const halfPot = s.currentBet + Math.floor((s.pot + toCall) / 2);
    const panel = h('div', { class: 'raise-panel' },
      h('div', { class: 'raise-row' }, slider, number),
      h('div', { class: 'raise-quick' },
        this._quickButton('Min', minTo), this._quickButton('\u00BD Pot', halfPot),
        this._quickButton('Pot', potSize), this._quickButton('All-in', maxTo)),
      h('div', { class: 'raise-confirm' },
        h('button', { type: 'button', class: 'btn btn-small', id: 'btn-raise-cancel', text: 'Back', onClick: this._onRaiseCancel }),
        confirm));
    this._syncRaise();
    return h('div', { class: 'controls', role: 'group', 'aria-label': 'Raise sizing' }, panel);
  }

  /** Open the raise sizing panel. */
  _onRaiseOpen = () => {
    this.raiseOpen = true;
    this._render();
  };

  /** Close the raise sizing panel without acting. */
  _onRaiseCancel = () => {
    this.raiseOpen = false;
    this._render();
  };

  /**
   * Build a quick-size button.
   * @param {string} label Button text.
   * @param {number} amount Target raise-to amount.
   * @returns {HTMLElement} Button.
   */
  _quickButton(label, amount) {
    return h('button', { type: 'button', class: 'btn btn-small', text: label, dataset: { amount: String(amount) }, onClick: this._onQuick });
  }

  /** Fold. */
  _onFold = () => this.session.send(MSG.PLAYER_ACTION, { action: 'FOLD' });

  /** Check. */
  _onCheck = () => this.session.send(MSG.PLAYER_ACTION, { action: 'CHECK' });

  /** Call. */
  _onCall = () => this.session.send(MSG.PLAYER_ACTION, { action: 'CALL' });

  /** Raise (or go all-in when the amount equals the stack). */
  _onRaise = () => {
    const refs = this.raiseRefs;
    if (!refs) return;
    this.raiseOpen = false;
    if (this.raiseTo >= refs.maxTo) this.session.send(MSG.PLAYER_ACTION, { action: 'ALL_IN' });
    else this.session.send(MSG.PLAYER_ACTION, { action: 'RAISE', amount: this.raiseTo });
  };

  /** Slider / number input change. @param {Event} event Input event. */
  _onRaiseInput = (event) => {
    this._setRaise(Number(event.target.value));
  };

  /** Quick-size button click. @param {MouseEvent} event Click event. */
  _onQuick = (event) => {
    this._setRaise(Number(event.currentTarget.dataset.amount));
  };

  /**
   * Clamp and apply a raise amount.
   * @param {number} value Desired raise-to amount.
   */
  _setRaise(value) {
    const refs = this.raiseRefs;
    if (!refs || !Number.isFinite(value)) return;
    this.raiseTo = Math.min(refs.maxTo, Math.max(refs.minTo, Math.round(value)));
    this._syncRaise();
  }

  /** Reflect the raise amount into the slider, number box and button label. */
  _syncRaise() {
    const refs = this.raiseRefs;
    if (!refs) return;
    refs.slider.value = String(this.raiseTo);
    refs.number.value = String(this.raiseTo);
    const verb = this.raiseTo >= refs.maxTo ? 'All-in' : refs.currentBet === 0 ? 'Bet' : 'Raise to';
    refs.confirm.textContent = `${verb} ${fmt(this.raiseTo)}`;
  }
}
