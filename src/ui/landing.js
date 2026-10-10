// Last Modified: 2026-10-10 (v2.0.0.0)
import { h } from './dom.js';
import { AVATARS, DEFAULT_AVATAR } from '../shared/avatars.js';
import { MAX_NAME_LENGTH, sanitizeName } from '../net/messages.js';

/**
 * Render the landing page: profile, "Create Table" and "Join Table with Code".
 * @param {HTMLElement} root Mount element.
 * @param {object} options Options.
 * @param {{playerName: string, avatarUrl: string}|null} options.profile Saved profile used to auto-fill.
 * @param {string} [options.notice] Message to show (e.g. why the last game ended).
 * @param {(data: {name: string, avatar: string, config: object}) => void} options.onCreate Create handler.
 * @param {(data: {name: string, avatar: string, code: string}) => void} options.onJoin Join handler.
 * @returns {{setError: (message: string) => void, setBusy: (busy: boolean) => void}} Controls.
 */
export function renderLanding(root, { notice, onCreate, onJoin }) {
  const errorBox = h('p', { class: 'form-error', role: 'alert', id: 'landing-error', text: notice || '' });

  const buyIn = numberField('cfg-buyin', 'Buy-in (chips)', 1000, 1);
  const smallBlind = numberField('cfg-sb', 'Small blind', 10, 1);
  const bigBlind = numberField('cfg-bb', 'Big blind', 20, 1);
  const perLevel = numberField('cfg-level', 'Blinds double every N hands (0 = never)', 10, 0);
  const codeInput = h('input', {
    id: 'join-code', type: 'text', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters',
    spellcheck: 'false', placeholder: 'CODE', class: 'code-input', 'aria-label': 'Join code',
  });
  const createButton = h('button', { id: 'btn-create', type: 'submit', class: 'btn btn-primary', text: 'Create Table' });
  const joinButton = h('button', { id: 'btn-join', type: 'submit', class: 'btn btn-accent', text: 'Join Table' });

  /** Submit handler for the create form. @param {SubmitEvent} event Submit event. */
  function onCreateSubmit(event) {
    event.preventDefault();
    setError('');
    onCreate({
      config: {
        buyIn: Number(buyIn.input.value), smallBlind: Number(smallBlind.input.value),
        bigBlind: Number(bigBlind.input.value), handsPerLevel: Number(perLevel.input.value),
      },
    });
  }
  /** Submit handler for the join form. @param {SubmitEvent} event Submit event. */
  function onJoinSubmit(event) {
    event.preventDefault();
    const code = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) return setError('Join codes are 5 characters long.');
    setError('');
    onJoin({ code });
  }
  /** Show an error message. @param {string} message Text. */
  function setError(message) {
    errorBox.textContent = message;
  }
  /** Disable the buttons while connecting. @param {boolean} busy Busy state. */
  function setBusy(busy) {
    createButton.disabled = busy;
    joinButton.disabled = busy;
    joinButton.textContent = busy ? 'Connecting...' : 'Join Table';
  }

  root.replaceChildren(
    h('main', { class: 'landing' },
      h('header', { class: 'landing-hero' },
        h('p', { class: 'hero-suits', 'aria-hidden': 'true', text: '\u2660 \u2665 \u2666 \u2663' }),
        h('h1', { text: 'Polka Poker' }),
        h('p', { class: 'hero-sub', text: "Texas Hold'em with friends. No accounts, no servers, just share a code." })),
      h('section', { class: 'panel', 'aria-labelledby': 'welcome-heading' },
        h('h2', { id: 'welcome-heading', text: 'Welcome' }),
        h('p', { text: 'Join or create a table to watch. You can claim an empty seat to play once inside.' })),
      h('div', { class: 'landing-actions' },
        h('form', { class: 'panel', onSubmit: onCreateSubmit, 'aria-labelledby': 'create-heading' },
          h('h2', { id: 'create-heading', text: 'Create Table' }),
          buyIn.field, smallBlind.field, bigBlind.field, perLevel.field, createButton),
        h('form', { class: 'panel', onSubmit: onJoinSubmit, 'aria-labelledby': 'join-heading' },
          h('h2', { id: 'join-heading', text: 'Join Table with Code' }),
          h('label', { for: 'join-code', text: 'Enter the 5-character code from the host' }), codeInput, joinButton)),
      errorBox,
      h('footer', { class: 'landing-footer', text: 'No accounts needed.' })));

  return { setError, setBusy };
}

/**
 * Build a labelled whole-number field.
 * @param {string} id Input id.
 * @param {string} label Label text.
 * @param {number} value Default value.
 * @param {number} min Minimum value.
 * @returns {{field: HTMLElement, input: HTMLInputElement}} Field wrapper and input.
 */
function numberField(id, label, value, min) {
  const input = h('input', { id, type: 'number', inputmode: 'numeric', min, step: 1, value, required: true });
  return { input, field: h('div', { class: 'field' }, h('label', { for: id, text: label }), input) };
}
