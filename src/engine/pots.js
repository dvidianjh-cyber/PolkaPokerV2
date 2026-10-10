// Last Modified: 2026-10-10 (v2.0.0.0)

/**
 * Build main and side pots from each player's total contribution.
 * @param {{id: string, contributed: number, folded: boolean}[]} entries Players in the hand.
 * @returns {{amount: number, eligible: string[]}[]} Pots, main pot first.
 */
export function buildPots(entries) {
  const levels = [...new Set(entries.map((e) => e.contributed).filter((c) => c > 0))].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  let carry = 0;
  for (const level of levels) {
    let amount = carry;
    for (const e of entries) {
      amount += Math.min(e.contributed, level) - Math.min(e.contributed, previous);
    }
    const eligible = entries.filter((e) => !e.folded && e.contributed >= level).map((e) => e.id);
    previous = level;
    if (eligible.length === 0) {
      if (pots.length > 0) pots[pots.length - 1].amount += amount - carry;
      else carry = amount;
      continue;
    }
    carry = 0;
    const last = pots[pots.length - 1];
    if (last && last.eligible.length === eligible.length && last.eligible.every((id, i) => id === eligible[i])) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligible });
    }
  }
  return pots;
}
