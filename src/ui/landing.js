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
export function renderLanding(root, { profile, notice, onCreate, onJoin }) {
  let avatar = profile ? profile.avatarUrl : DEFAULT_AVATAR;

  const nameInput = h('input', {
    id: 'player-name', type: 'text', maxlength: MAX_NAME_LENGTH, autocomplete: 'nickname',
    value: profile ? profile.playerName : '', placeholder: 'Your name', required: true,
  });
  const errorBox = h('p', { class: 'form-error', role: 'alert', id: 'landing-error', text: notice || '' });
  const avatarButtons = [];

  /** Select an avatar button. @param {string} token Avatar token. */
  function selectAvatar(token) {
    avatar = token;
    for (const btn of avatarButtons) btn.setAttribute('aria-checked', String(btn.dataset.avatar === token));
  }
  /** Click handler for avatar buttons. @param {MouseEvent} event Click event. */
  function onAvatarClick(event) {
    selectAvatar(event.currentTarget.dataset.avatar);
  }
  for (const a of AVATARS) {
    const token = `emoji:${a.id}`;
    avatarButtons.push(h('button', {
      type: 'button', class: 'avatar-option', role: 'radio', 'aria-label': a.id,
      'aria-checked': String(token === avatar), dataset: { avatar: token }, text: a.glyph, onClick: onAvatarClick,
    }));
  }

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

  /** Read and sanitise the player's name. @returns {string} Name or empty. */
  function readName() {
    return sanitizeName(nameInput.value);
  }
  /** Submit handler for the create form. @param {SubmitEvent} event Submit event. */
  function onCreateSubmit(event) {
    event.preventDefault();
    const name = readName();
    if (!name) return setError('Please enter a name first.');
    setError('');
    onCreate({
      name, avatar,
      config: {
        buyIn: Number(buyIn.input.value), smallBlind: Number(smallBlind.input.value),
        bigBlind: Number(bigBlind.input.value), handsPerLevel: Number(perLevel.input.value),
      },
    });
  }
  /** Submit handler for the join form. @param {SubmitEvent} event Submit event. */
  function onJoinSubmit(event) {
    event.preventDefault();
    const name = readName();
    if (!name) return setError('Please enter a name first.');
    const code = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) return setError('Join codes are 5 characters long.');
    setError('');
    onJoin({ name, avatar, code });
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
      h('section', { class: 'panel', 'aria-labelledby': 'profile-heading' },
        h('h2', { id: 'profile-heading', text: 'Your player' }),
        h('label', { for: 'player-name', text: 'Name (max 12 characters)' }), nameInput,
        h('div', { class: 'avatar-picker', role: 'radiogroup', 'aria-label': 'Choose an avatar' }, avatarButtons)),
      h('div', { class: 'landing-actions' },
        h('form', { class: 'panel', onSubmit: onCreateSubmit, 'aria-labelledby': 'create-heading' },
          h('h2', { id: 'create-heading', text: 'Create Table' }),
          buyIn.field, smallBlind.field, bigBlind.field, perLevel.field, createButton),
        h('form', { class: 'panel', onSubmit: onJoinSubmit, 'aria-labelledby': 'join-heading' },
          h('h2', { id: 'join-heading', text: 'Join Table with Code' }),
          h('label', { for: 'join-code', text: 'Enter the 5-character code from the host' }), codeInput, joinButton)),
      errorBox,
      h('footer', { class: 'landing-footer', text: 'Your name and avatar are remembered only in this browser.' })));

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
