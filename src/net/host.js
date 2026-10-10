// Last Modified: 2026-10-10 (v2.0.0.0)
import Peer from 'peerjs';
import { Game } from '../engine/game.js';
import { secureRandomInt } from '../engine/deck.js';
import { MSG, parseClientMessage } from './messages.js';

/** Prefix keeping our ids unique on the shared PeerJS signaling server. */
export const PEER_PREFIX = 'polkapoker2-';
/** Player id used for the table creator's local seat. */
export const HOST_ID = 'host';
/** Per-turn time allowance in milliseconds. */
export const TURN_MS = 60000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_CONNECTIONS = 20;

/**
 * Generate a short, unambiguous join code.
 * @returns {string} Join code.
 */
export function generateJoinCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[secureRandomInt(CODE_ALPHABET.length)];
  return code;
}

/**
 * Normalise user input into a join code.
 * @param {string} input Raw text.
 * @returns {string|null} Code, or null if it cannot be valid.
 */
export function normalizeJoinCode(input) {
  const code = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH ? code : null;
}

/**
 * Host session: owns the authoritative Game, accepts peer connections,
 * validates every message, runs the turn timer and broadcasts state.
 */
export class HostSession {
  /**
   * @param {object} options Session options.
   * @param {string} options.name Host display name.
   * @param {string} options.avatar Host avatar token.
   * @param {object} options.config Validated table config.
   * @param {(state: object) => void} options.onState Called with the host's view on every change.
   * @param {(message: string) => void} options.onError Called with non-fatal errors.
   */
  constructor({ name, avatar, config, onState, onError }) {
    this.myId = HOST_ID;
    this.code = null;
    this.game = new Game(config, HOST_ID);
    this.profiles = new Map([[HOST_ID, { name, avatar }]]);
    this.conns = new Map();
    this.onState = onState;
    this.onError = onError;
    this.peer = null;
    this.timer = null;
    this.timerKey = null;
    this.deadline = null;
    this.closed = false;
    this.game.sit(HOST_ID, name, avatar, 0);
  }

  /**
   * Register with the signaling server and open the table.
   * @returns {Promise<string>} The join code.
   */
  start() {
    return new Promise((resolve, reject) => {
      const attempt = (tries) => {
        const code = generateJoinCode();
        const peer = new Peer(PEER_PREFIX + code);
        let opened = false;
        const onOpen = () => {
          opened = true;
          this.peer = peer;
          this.code = code;
          peer.on('connection', this._onConnection);
          peer.on('disconnected', onDisconnected);
          this._afterChange();
          resolve(code);
        };
        const onPeerError = (err) => {
          if (!opened && err.type === 'unavailable-id' && tries < 5) {
            peer.destroy();
            attempt(tries + 1);
          } else if (!opened) {
            peer.destroy();
            reject(new Error('Could not reach the matchmaking server. Check your connection.'));
          } else {
            this.onError(`Network error: ${err.type || err.message}`);
          }
        };
        const onDisconnected = () => {
          if (!this.closed && !peer.destroyed) peer.reconnect();
        };
        peer.on('open', onOpen);
        peer.on('error', onPeerError);
      };
      attempt(0);
    });
  }

  /**
   * Send a message as the host's own player (same validation as any peer).
   * @param {string} type Message type.
   * @param {object} [payload] Message payload.
   */
  send(type, payload = {}) {
    this.receive(HOST_ID, { type, payload });
  }

  /**
   * Validate and apply a message from a player.
   * @param {string} id Sender id (set by the transport, never by the message).
   * @param {unknown} raw Raw message.
   */
  receive(id, raw) {
    if (this.closed) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this._sendError(id, parsed.error);
      return;
    }
    const { type, payload } = parsed;
    let result = { ok: true };
    if (type === MSG.JOIN) {
      if (id !== HOST_ID && this.game.seatOf(id) < 0) this.profiles.set(id, payload);
    } else {
      const profile = this.profiles.get(id);
      if (!profile) {
        this._sendError(id, 'Join the table first');
        return;
      }
      if (type === MSG.SIT) result = this.game.sit(id, profile.name, profile.avatar, payload.seat);
      else if (type === MSG.LEAVE_SEAT) result = this.game.removePlayer(id);
      else if (type === MSG.PLAYER_ACTION) result = this.game.applyAction(id, payload);
      else if (type === MSG.DEAL_HAND) result = this.game.startHand(id);
    }
    if (!result.ok) this._sendError(id, result.error);
    this._afterChange();
  }

  /**
   * End the game: tell peers, then shut down networking.
   * @param {string} [reason] Message shown to peers.
   */
  close(reason = 'The host ended the game.') {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send({ type: MSG.GAME_ENDED, payload: { reason } });
    }
    const peer = this.peer;
    setTimeout(() => peer && peer.destroy(), 300);
  }

  /**
   * Accept a new incoming data connection.
   * @param {object} conn PeerJS DataConnection.
   */
  _onConnection = (conn) => {
    if (this.closed || this.conns.size >= MAX_CONNECTIONS) {
      conn.on('open', () => conn.close());
      return;
    }
    const id = conn.peer;
    const onOpen = () => {
      this.conns.set(id, conn);
    };
    const onData = (data) => this.receive(id, data);
    const onClose = () => this._onDisconnect(id);
    conn.on('open', onOpen);
    conn.on('data', onData);
    conn.on('close', onClose);
    conn.on('error', onClose);
  };

  /**
   * Handle a peer leaving: fold and unseat them.
   * @param {string} id Peer id.
   */
  _onDisconnect(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.profiles.delete(id);
    this.game.removePlayer(id);
    this._afterChange();
  }

  /**
   * Send an error to a player.
   * @param {string} id Player id.
   * @param {string} message Error text.
   */
  _sendError(id, message) {
    if (id === HOST_ID) this.onError(message);
    else {
      const conn = this.conns.get(id);
      if (conn && conn.open) conn.send({ type: MSG.ERROR, payload: { message } });
    }
  }

  /** Restart the turn clock when the turn changed, then broadcast. */
  _afterChange() {
    const game = this.game;
    const key = game.toActSeat === null ? null : `${game.handNumber}:${game.actionCount}`;
    if (key !== this.timerKey) {
      clearTimeout(this.timer);
      this.timerKey = key;
      if (key) {
        this.deadline = Date.now() + TURN_MS;
        this.timer = setTimeout(this._onTurnTimeout, TURN_MS);
      } else {
        this.deadline = null;
      }
    }
    this._broadcast();
  }

  /** Enforce the 60s limit: check if free, fold if facing a bet. */
  _onTurnTimeout = () => {
    if (this.closed) return;
    this.game.timeoutAction();
    this._afterChange();
  };

  /** Push each participant their own view of the state. */
  _broadcast() {
    const remaining = this.deadline ? Math.max(0, this.deadline - Date.now()) : null;
    const make = (id) => ({ ...this.game.getView(id), turnMsRemaining: remaining, turnMs: TURN_MS });
    this.onState(make(HOST_ID));
    for (const [id, conn] of this.conns) {
      if (conn.open) conn.send({ type: MSG.STATE_UPDATE, payload: make(id) });
    }
  }
}
