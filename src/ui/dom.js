// Last Modified: 2026-10-10 (v2.0.0.0)

/**
 * Create a DOM element. All text is set through text nodes / textContent so
 * untrusted strings (e.g. player names) can never inject markup.
 * Props: `class`, `text`, `dataset`, `onXxx` listeners (pass named functions),
 * boolean attributes, anything else becomes an attribute.
 * @param {string} tag Element tag name.
 * @param {Object<string, unknown>} [props] Properties and attributes.
 * @param {...(Node|string|null|false|Array)} children Child nodes or strings.
 * @returns {HTMLElement} The element.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  appendChildren(el, children);
  return el;
}

/**
 * Append children, flattening arrays and skipping empty values.
 * @param {HTMLElement} el Parent element.
 * @param {Array} children Children to append.
 */
function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * Format a chip amount for display.
 * @param {number} value Chip amount.
 * @returns {string} Formatted string.
 */
export function fmt(value) {
  return Number(value).toLocaleString('en-GB');
}

/**
 * Build a flat 2D chip showing its numeric value for instant readability.
 * @param {number} value Chip amount.
 * @param {string} [extraClass] Additional class names.
 * @returns {HTMLElement} Chip element.
 */
export function chip(value, extraClass = '') {
  const tier = Math.min(4, Math.max(0, String(Math.max(1, Math.floor(value))).length - 1));
  const numChips = Math.min(10, Math.max(1, Math.ceil(Math.log10(value + 1) * 2)));
  const visualChips = [];
  for (let i = 0; i < numChips; i++) {
    visualChips.push(h('span', { class: `chip-graphic chip--${tier}`, style: `bottom: ${i * 3}px; z-index: ${i};` }));
  }
  return h('span', { class: `chip-stack ${extraClass}`.trim() },
    h('span', { class: 'chip-visuals' }, visualChips),
    h('span', { class: 'chip-value', text: fmt(value) })
  );
}
