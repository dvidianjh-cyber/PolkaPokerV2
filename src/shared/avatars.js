// Last Modified: 2026-10-10 (v2.0.0.0)

/** Preset emoji avatars for V1. Avatar tokens have the form "emoji:<id>". */
export const AVATARS = Object.freeze([
  { id: 'fox', glyph: '🦊' },
  { id: 'bear', glyph: '🐻' },
  { id: 'panda', glyph: '🐼' },
  { id: 'lion', glyph: '🦁' },
  { id: 'frog', glyph: '🐸' },
  { id: 'owl', glyph: '🦉' },
  { id: 'octopus', glyph: '🐙' },
  { id: 'unicorn', glyph: '🦄' },
  { id: 'robot', glyph: '🤖' },
  { id: 'alien', glyph: '👽' },
  { id: 'pirate', glyph: '🏴‍☠️' },
  { id: 'cowboy', glyph: '🤠' },
]);

/** Avatar token used when none is chosen. */
export const DEFAULT_AVATAR = 'emoji:fox';

/**
 * Check whether a token is a known avatar.
 * @param {unknown} token Candidate token.
 * @returns {boolean} True for valid preset avatars.
 */
export function isValidAvatar(token) {
  return typeof token === 'string' && AVATARS.some((a) => `emoji:${a.id}` === token);
}

/**
 * Resolve an avatar token to the glyph to display.
 * @param {string} token Avatar token.
 * @returns {string} Emoji glyph.
 */
export function avatarGlyph(token) {
  const found = AVATARS.find((a) => `emoji:${a.id}` === token);
  return found ? found.glyph : AVATARS[0].glyph;
}
