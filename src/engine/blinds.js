// Last Modified: 2026-10-10 (v2.0.0.0)

/** Maximum number of seats at a table. */
export const MAX_SEATS = 8;
const MAX_LEVEL = 12;

/**
 * Validate and normalise table configuration supplied by the table creator.
 * @param {object} raw Candidate configuration.
 * @returns {{ok: boolean, error?: string, config?: {buyIn: number, smallBlind: number, bigBlind: number, handsPerLevel: number}}} Result.
 */
export function validateConfig(raw) {
  const fields = ['buyIn', 'smallBlind', 'bigBlind', 'handsPerLevel'];
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Missing table settings' };
  const config = {};
  for (const key of fields) {
    const value = raw[key];
    if (!Number.isSafeInteger(value) || value < 0) return { ok: false, error: `${key} must be a whole number` };
    config[key] = value;
  }
  if (config.buyIn <= 0) return { ok: false, error: 'Buy-in must be a positive whole number' };
  if (config.smallBlind <= 0) return { ok: false, error: 'Small blind must be a positive whole number' };
  if (config.bigBlind < config.smallBlind) return { ok: false, error: 'Big blind cannot be below the small blind' };
  if (config.buyIn < config.bigBlind * 2) return { ok: false, error: 'Buy-in must be at least two big blinds' };
  if (config.handsPerLevel > 100) return { ok: false, error: 'Hands per blind level is capped at 100' };
  return { ok: true, config };
}

/**
 * Blind level for a hand. Level 0 applies when increases are disabled.
 * @param {number} handNumber 1-based hand number.
 * @param {number} handsPerLevel Hands between increases (0 = never).
 * @returns {number} Level index.
 */
export function blindLevel(handNumber, handsPerLevel) {
  if (!handsPerLevel || handNumber < 1) return 0;
  return Math.min(MAX_LEVEL, Math.floor((handNumber - 1) / handsPerLevel));
}

/**
 * Blinds for a given hand. Blinds double at each level.
 * @param {{smallBlind: number, bigBlind: number, handsPerLevel: number}} config Table config.
 * @param {number} handNumber 1-based hand number.
 * @returns {{smallBlind: number, bigBlind: number, level: number}} Blinds.
 */
export function blindsFor(config, handNumber) {
  const level = blindLevel(handNumber, config.handsPerLevel);
  const factor = 2 ** level;
  return { smallBlind: config.smallBlind * factor, bigBlind: config.bigBlind * factor, level };
}
