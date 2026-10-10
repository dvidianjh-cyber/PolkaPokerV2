// Last Modified: 2026-10-10 (v2.0.0.0)
import { describe, it, expect } from 'vitest';
import { parseClientMessage, sanitizeName, MSG } from '../src/net/messages.js';

describe('message validation', () => {
  it('sanitises names', () => {
    expect(sanitizeName('  <b>Bob</b>  ')).toBe('bBob/b');
    expect(sanitizeName('A'.repeat(40))).toHaveLength(12);
    expect(sanitizeName('x\u0000\u202Ey')).toBe('xy');
    expect(sanitizeName(42)).toBe('');
  });

  it('rejects malformed, oversized and unknown messages', () => {
    expect(parseClientMessage(null).ok).toBe(false);
    expect(parseClientMessage('RAISE').ok).toBe(false);
    expect(parseClientMessage({ type: 'HACK', payload: {} }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.JOIN, payload: { name: 'x'.repeat(5000) } }).ok).toBe(false);
  });

  it('validates actions and amounts', () => {
    expect(parseClientMessage({ type: MSG.PLAYER_ACTION, payload: { action: 'RAISE', amount: 50 } }).ok).toBe(true);
    expect(parseClientMessage({ type: MSG.PLAYER_ACTION, payload: { action: 'RAISE', amount: -5 } }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.PLAYER_ACTION, payload: { action: 'RAISE', amount: 1.5 } }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.PLAYER_ACTION, payload: { action: 'RAISE' } }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.PLAYER_ACTION, payload: { action: 'STEAL' } }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.SIT, payload: { seat: 8 } }).ok).toBe(false);
    expect(parseClientMessage({ type: MSG.SIT, payload: { seat: 7 } }).ok).toBe(true);
  });

  it('falls back to the default avatar and requires a name', () => {
    const joined = parseClientMessage({ type: MSG.JOIN, payload: { name: 'Ann', avatar: 'http://evil' } });
    expect(joined.payload.avatar).toBe('emoji:fox');
    expect(parseClientMessage({ type: MSG.JOIN, payload: { name: '   ' } }).ok).toBe(false);
  });
});
