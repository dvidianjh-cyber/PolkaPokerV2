// Last Modified: 2026-10-10 (v2.0.0.0)
import Peer from 'peerjs';
import { MSG } from './messages.js';
import { PEER_PREFIX } from './host.js';

const CONNECT_TIMEOUT_MS = 15000;

/**
 * Client session: connects to a host by join code, sends validated intents
 * and renders whatever state the host broadcasts (single source of truth).
 */
export class ClientSession {
  /**
   * @param {object} options Session options.
   * @param {string} options.name Display name.
   * @param {string} options.avatar Avatar token.
   * @param {string} options.code Normalised join code.
   * @param {(state: object) => void} options.onState Called with every state update.
   * @param {(message: string) => void} options.onError Called for non-fatal errors.
   * @param {(reason: string) => void} options.onClosed Called when the game ends.
   */
  constructor({ name, avatar, code, onState, onError, onClosed }) {
    this.name = name;
    this.avatar = avatar;
    this.code = code;
    this.onState = onState;
    this.onError = onError;
    this.onClosed = onClosed;
    this.peer = null;
    this.conn = null;
    this.myId = null;
    this.joined = false;
    this.ended = false;
  }

  /**
   * Connect to the host and wait for the first state.
   * @returns {Promise<void>} Resolves once joined.
   */
  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(onTimeout, CONNECT_TIMEOUT_MS);
      const peer = new Peer();
      this.peer = peer;

      /** Abort the attempt with an error. @param {string} message Error text. */
      const abort = (message) => {
        clearTimeout(timeout);
        peer.destroy();
        reject(new Error(message));
      };
      function onTimeout() {
        abort('Could not find that table. Check the code and try again.');
      }
      const onPeerOpen = () => {
        const conn = peer.connect(PEER_PREFIX + this.code, { reliable: true });
        this.conn = conn;
        const onConnOpen = () => this.send(MSG.JOIN, { name: this.name, avatar: this.avatar });
        const onData = (data) => {
          if (!data || typeof data !== 'object') return;
          if (data.type === MSG.STATE_UPDATE && data.payload) {
            this.myId = data.payload.youId;
            if (!this.joined) {
              this.joined = true;
              clearTimeout(timeout);
              resolve();
            }
            this.onState(data.payload);
          } else if (data.type === MSG.ERROR && data.payload) {
            this.onError(String(data.payload.message || 'Error'));
          } else if (data.type === MSG.GAME_ENDED) {
            this._end(String((data.payload && data.payload.reason) || 'The game has ended.'));
          }
        };
        const onConnClose = () => {
          if (!this.joined) abort('The table closed the connection.');
          else this._end('The host disconnected, so the game has ended.');
        };
        conn.on('open', onConnOpen);
        conn.on('data', onData);
        conn.on('close', onConnClose);
        conn.on('error', onConnClose);
      };
      const onPeerError = (err) => {
        if (!this.joined) {
          abort(err.type === 'peer-unavailable' ? 'No table found with that code.' : 'Could not reach the matchmaking server.');
        } else {
          this.onError(`Network error: ${err.type || err.message}`);
        }
      };
      peer.on('open', onPeerOpen);
      peer.on('error', onPeerError);
    });
  }

  /**
   * Send an intent to the host.
   * @param {string} type Message type.
   * @param {object} [payload] Message payload.
   */
  send(type, payload = {}) {
    if (this.conn && this.conn.open) this.conn.send({ type, payload });
  }

  /** Leave the table and close the connection. */
  close() {
    this.ended = true;
    if (this.peer) this.peer.destroy();
  }

  /**
   * Finish the session once.
   * @param {string} reason Reason shown to the user.
   */
  _end(reason) {
    if (this.ended) return;
    this.ended = true;
    if (this.peer) this.peer.destroy();
    this.onClosed(reason);
  }
}
