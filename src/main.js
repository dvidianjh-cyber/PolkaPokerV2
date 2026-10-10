// Last Modified: 2026-10-10 (v2.0.0.0)
import { renderLanding } from './ui/landing.js';
import { TableView } from './ui/table.js';
import { HostSession } from './net/host.js';
import { ClientSession } from './net/client.js';
import { validateConfig } from './engine/blinds.js';
import { MSG } from './net/messages.js';
import { loadProfile, saveProfile, loadPrefs, savePrefs } from './storage/profile.js';

export const APP_VERSION = '2.0.0.0';

const root = document.getElementById('app');
let session = null;
let table = null;
let landing = null;
let prefs = loadPrefs();

/**
 * Show the landing page and tear down any running session.
 * @param {string} [notice] Message to display.
 */
function showLanding(notice = '') {
  if (table) table.destroy();
  if (session) session.close();
  table = null;
  session = null;
  landing = renderLanding(root, { profile: loadProfile(), notice, onCreate: handleCreate, onJoin: handleJoin });
}

/**
 * Route a state update to the table view, creating it on first state.
 * @param {object} state State from the Host.
 */
function handleState(state) {
  if (!table) {
    table = new TableView(root, {
      session, code: session.code, isHost: session instanceof HostSession,
      prefs, onLeave: handleLeave, onPrefsChange: handlePrefsChange,
    });
  }
  table.update(state);
}

/**
 * Show a non-fatal error in the active view.
 * @param {string} message Error text.
 */
function handleError(message) {
  if (table) table.toast(message);
  else if (landing) landing.setError(message);
}

/** Leave the table (host: end the game for everyone). */
function handleLeave() {
  if (session) {
    if (session instanceof HostSession) session.close('The host ended the game.');
    else session.send(MSG.LEAVE_SEAT);
  }
  showLanding();
}

/**
 * Persist display preferences.
 * @param {{fourColour: boolean}} next New preferences.
 */
function handlePrefsChange(next) {
  prefs = next;
  savePrefs(prefs);
}

/**
 * Create a table as host.
 * @param {{name: string, avatar: string, config: object}} data Form data.
 */
async function handleCreate({ name, avatar, config }) {
  const checked = validateConfig(config);
  if (!checked.ok) {
    landing.setError(checked.error);
    return;
  }
  saveProfile({ playerName: name, avatarUrl: avatar });
  landing.setBusy(true);
  const host = new HostSession({ name, avatar, config: checked.config, onState: handleState, onError: handleError });
  session = host;
  try {
    await host.start();
  } catch (error) {
    session = null;
    landing.setBusy(false);
    landing.setError(error.message);
  }
}

/**
 * Join an existing table.
 * @param {{name: string, avatar: string, code: string}} data Form data.
 */
async function handleJoin({ name, avatar, code }) {
  saveProfile({ playerName: name, avatarUrl: avatar });
  landing.setBusy(true);
  const client = new ClientSession({
    name, avatar, code, onState: handleState, onError: handleError, onClosed: handleClosed,
  });
  session = client;
  try {
    await client.connect();
  } catch (error) {
    session = null;
    landing.setBusy(false);
    landing.setError(error.message);
  }
}

/**
 * The game ended (e.g. the host dropped): return to the landing page.
 * @param {string} reason Why the game ended.
 */
function handleClosed(reason) {
  session = null;
  showLanding(reason);
}

/** Close connections when the tab closes so peers are notified promptly. */
function onBeforeUnload() {
  if (session instanceof HostSession) session.close('The host left, so the game has ended.');
  else if (session) session.close();
}
window.addEventListener('beforeunload', onBeforeUnload);

showLanding();
