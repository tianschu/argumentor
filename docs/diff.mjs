// diff.mjs — word-level difference between two texts (longest common subsequence), for draft → revision views.
const MAX_TOKENS = 3000;

export function wordDiff(before, after) {
  const a = String(before || '').split(/(\s+)/).filter(Boolean);
  const b = String(after || '').split(/(\s+)/).filter(Boolean);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) return null;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = a[i] === b[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const parts = [];
  const push = (type, text) => {
    const last = parts.at(-1);
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]); i += 1; j += 1; }
    else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) { push('del', a[i]); i += 1; }
    else { push('add', b[j]); j += 1; }
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('add', b[j++]);
  return parts;
}

export function diffStats(parts) {
  if (!parts) return null;
  const words = text => (text.match(/\S+/g) || []).length;
  return parts.reduce((stats, part) => { stats[part.type] += words(part.text); return stats; }, { same: 0, add: 0, del: 0 });
}
