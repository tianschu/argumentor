// html.mjs — auto-escaping templates. Every interpolated value is HTML-escaped unless it was itself produced
// by html`` or explicitly wrapped with raw(), so forgetting esc() can no longer create an XSS hole.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ENTITIES[char]);

class Safe {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

// Marks trusted markup (only for strings built in this code base, never for learner or model text).
export const raw = value => new Safe(String(value ?? ''));

function render(value) {
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || value === false) return '';
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, index) => { out += render(value) + strings[index + 1]; });
  return new Safe(out);
}

export const join = (items, separator = '') => raw(items.map(render).join(render(separator)));
