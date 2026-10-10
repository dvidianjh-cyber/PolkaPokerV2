// Last Modified: 2026-10-10 (v2.0.0.0)
import { isValidAvatar, DEFAULT_AVATAR } from '../shared/avatars.js';
import { sanitizeName } from '../net/messages.js';

const PROFILE_KEY = 'polkapoker.v2.profile';
const PREFS_KEY = 'polkapoker.v2.prefs';

/**
 * Load the saved profile.
 * @returns {{playerName: string, avatarUrl: string}|null} Validated profile or null.
 */
export function loadProfile() {
  try {
    const data = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!data || typeof data !== 'object') return null;
    const playerName = sanitizeName(data.playerName);
    if (!playerName) return null;
    return { playerName, avatarUrl: isValidAvatar(data.avatarUrl) ? data.avatarUrl : DEFAULT_AVATAR };
  } catch {
    return null;
  }
}

/**
 * Persist the profile as strict JSON.
 * @param {{playerName: string, avatarUrl: string}} profile Profile to save.
 */
export function saveProfile(profile) {
  const safe = { playerName: sanitizeName(profile.playerName), avatarUrl: isValidAvatar(profile.avatarUrl) ? profile.avatarUrl : DEFAULT_AVATAR };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(safe));
  } catch {
    /* storage unavailable: the app still works, just without memory */
  }
}

/**
 * Load display preferences.
 * @returns {{fourColour: boolean}} Preferences.
 */
export function loadPrefs() {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY));
    return { fourColour: Boolean(data && data.fourColour) };
  } catch {
    return { fourColour: false };
  }
}

/**
 * Persist display preferences.
 * @param {{fourColour: boolean}} prefs Preferences.
 */
export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ fourColour: Boolean(prefs.fourColour) }));
  } catch {
    /* storage unavailable */
  }
}
