// Last Modified: 2026-10-10 (v2.0.0.0)
import { CARD_PATTERN } from '../engine/cards.js';
import { h } from './dom.js';

const SUIT_GLYPH = { s: '\u2660\uFE0E', h: '\u2665\uFE0E', d: '\u2666\uFE0E', c: '\u2663\uFE0E' };
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK_NAME = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
const TWO_COLOUR = { s: '#14161a', c: '#14161a', h: '#c4121f', d: '#c4121f' };
const FOUR_COLOUR = { s: '#14161a', h: '#c4121f', d: '#0b4fd1', c: '#0a7a2c' };

/**
 * Accessible label for a card.
 * @param {string} code Card code.
 * @returns {string} e.g. "Ace of spades".
 */
export function cardLabel(code) {
  if (!CARD_PATTERN.test(code)) return 'Unknown card';
  return `${RANK_NAME[code[0]]} of ${SUIT_NAME[code[1]]}`;
}

/**
 * Build the SVG markup for a face-up card. Input is validated against
 * {@link CARD_PATTERN}, so the generated markup contains only fixed strings.
 * @param {string} code Card code.
 * @param {boolean} fourColour Use the four-colour deck.
 * @returns {string} SVG markup.
 */
function faceSvg(code, fourColour) {
  const rank = code[0] === 'T' ? '10' : code[0];
  const suit = SUIT_GLYPH[code[1]];
  const colour = (fourColour ? FOUR_COLOUR : TWO_COLOUR)[code[1]];
  const rankSize = rank.length > 1 ? 70 : 84;
  const corner = `<text x="52" y="92" font-size="${rankSize}">${rank}</text><text x="52" y="160" font-size="66">${suit}</text>`;
  return `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`
    + `<rect x="4" y="4" width="242" height="342" rx="24" fill="#fffdf6" stroke="#1d1d1d" stroke-width="6"/>`
    + `<g fill="${colour}" font-family="'Trebuchet MS','Segoe UI','DejaVu Sans',Arial,sans-serif" font-weight="800" text-anchor="middle">`
    + `${corner}<text x="125" y="238" font-size="150">${suit}</text>`
    + `<g transform="rotate(180 125 175)">${corner}</g></g></svg>`;
}

/**
 * SVG markup for a card back.
 * @returns {string} SVG markup.
 */
function backSvg() {
  return '<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
    + '<defs><pattern id="cb" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="28" height="28" fill="#12306b"/><rect width="14" height="14" fill="#1d4a9e"/><rect x="14" y="14" width="14" height="14" fill="#1d4a9e"/></pattern></defs>'
    + '<rect x="4" y="4" width="242" height="342" rx="24" fill="#fffdf6" stroke="#1d1d1d" stroke-width="6"/>'
    + '<rect x="22" y="22" width="206" height="306" rx="14" fill="url(#cb)" stroke="#fffdf6" stroke-width="4"/></svg>';
}

/**
 * Create a card element (face-up, or face-down when no valid code is given).
 * @param {string|null} code Card code or null for a card back.
 * @param {{fourColour?: boolean, size?: 'board'|'hand'|'mini'}} [options] Display options.
 * @returns {HTMLElement} Card element.
 */
export function cardElement(code, options = {}) {
  const { fourColour = false, size = 'board' } = options;
  const faceUp = typeof code === 'string' && CARD_PATTERN.test(code);
  const el = h('span', {
    class: `card card--${size}${faceUp ? '' : ' card--back'}`,
    role: 'img',
    'aria-label': faceUp ? cardLabel(code) : 'Face-down card',
  });
  // Markup is built only from validated constants (see faceSvg), never from raw input.
  el.innerHTML = faceUp ? faceSvg(code, fourColour) : backSvg();
  return el;
}
