// Last Modified: 2026-10-10 (v2.0.0.0)
import { isValidAvatar, DEFAULT_AVATAR } from '../shared/avatars.js';
import { MAX_SEATS } from '../engine/blinds.js';

/** Message type constants (Event Bus pattern). */
export const MSG = Object.freeze({
  // Peer -> Host
  JOIN: 'JOIN',
  SIT: 'SIT',
  LEAVE_SEAT: 'LEAVE_SEAT',
  PLAYER_ACTION: 'PLAYER_ACTION',
  DEAL_HAND: 'DEAL_HAND',
  // Host -> Peer
  STATE_UPDATE: 'STATE_UPDATE',
  ERROR: 'ERROR',
  GAME_ENDED: 'GAME_ENDED',
});

/** Maximum player name length. */
export const MAX_NAME_LENGTH = 12;
const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN']);
const MAX_MESSAGE_BYTES = 2000;

/**
 * Sanitise a player name: strip control characters and markup characters,
 * collapse whitespace and cap the length.
 * @param {unknown} value Raw name.
 * @returns {string} Safe name (may be empty).
 */
export function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[<>&"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('').trim();
}

/**
 * Validate a message arriving at the Host from a peer. Never trusts the sender.
 * @param {unknown} raw Received data.
 * @returns {{ok: true, type: string, payload: object} | {ok: false, error: string}} Parsed message or error.
 */
export function parseClientMessage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('Malformed message');
  let size;
  try {
    size = JSON.stringify(raw).length;
  } catch {
    return bad('Malformed message');
  }
  if (size > MAX_MESSAGE_BYTES) return bad('Message too large');
  const { type } = raw;
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
  switch (type) {
    case MSG.JOIN: {
      const name = sanitizeName(payload.name);
      if (!name) return bad('Please enter a name');
      const avatar = isValidAvatar(payload.avatar) ? payload.avatar : DEFAULT_AVATAR;
      return { ok: true, type, payload: { name, avatar } };
    }
    case MSG.SIT:
      if (!Number.isInteger(payload.seat) || payload.seat < 0 || payload.seat >= MAX_SEATS) return bad('Invalid seat');
      return { ok: true, type, payload: { seat: payload.seat } };
    case MSG.PLAYER_ACTION: {
      if (typeof payload.action !== 'string' || !ACTIONS.has(payload.action)) return bad('Unknown action');
      const out = { action: payload.action };
      if (payload.action === 'RAISE') {
        if (!Number.isSafeInteger(payload.amount) || payload.amount <= 0) return bad('Invalid amount');
        out.amount = payload.amount;
      }
      return { ok: true, type, payload: out };
    }
    case MSG.LEAVE_SEAT:
    case MSG.DEAL_HAND:
      return { ok: true, type, payload: {} };
    default:
      return bad('Unknown message type');
  }
}

/**
 * Build a failure result.
 * @param {string} error Message.
 * @returns {{ok: false, error: string}} Failure.
 */
function bad(error) {
  return { ok: false, error };
}
