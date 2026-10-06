// worker/preflight.mjs — checks wrangler.toml before you deploy.
//   cd worker && node preflight.mjs
// It reads only the local config; it contacts nothing and never touches your key.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const text = await readFile(join(here, 'wrangler.toml'), 'utf8');

// Values outside a [section]; good enough for this small, known file.
const value = name => {
  const match = text.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : '';
};
const live = line => new RegExp(`^\\s*${line}`, 'm').test(text);

const problems = [];
const warnings = [];
const notes = [];

const origin = value('ALLOWED_ORIGIN');
if (!origin || origin.includes('YOUR-USERNAME')) {
  problems.push('ALLOWED_ORIGIN is still the placeholder. Set it to your site\'s origin, e.g. "https://yourname.github.io".');
} else if (!/^https:\/\/[^/]+$/.test(origin)) {
  problems.push(`ALLOWED_ORIGIN must be an origin only — no path, no trailing slash. Got "${origin}".\n     From https://yourname.github.io/argumentor/ the origin is https://yourname.github.io`);
} else {
  notes.push(`Site origin allowed to call this Worker: ${origin}`);
}

if (live('\\[\\[kv_namespaces\\]\\]') && live('id\\s*=')) {
  const id = value('id');
  if (!id || id.includes('paste-the-id')) problems.push('The KV namespace block is uncommented but its id is still the placeholder.');
  else notes.push(`KV namespace bound (${id.slice(0, 8)}…) — the daily cap will hold across isolates.`);
} else {
  warnings.push('No KV namespace bound. Daily caps fall back to per-isolate memory, so real usage can exceed\n     the cap. Run:  npx wrangler kv namespace create ARGUMENTOR_KV\n     then uncomment the [[kv_namespaces]] block and paste the id.');
}

const calls = Number(value('MAX_DAILY_CALLS'));
const tokens = Number(value('MAX_DAILY_TOKENS'));
if (Number.isFinite(calls) && calls > 0) notes.push(`Daily ceiling: ${calls} calls (about ${Math.floor(calls / 4)} full reviews).`);
if (Number.isFinite(tokens) && tokens > 0) notes.push(`Daily ceiling: ${tokens.toLocaleString('en-US')} tokens.`);
if (calls > 2000 || tokens > 10000000) warnings.push('Those ceilings are high for a public link. Consider lowering them while you test.');

if (/sk-[A-Za-z0-9]{20,}/.test(text)) {
  problems.push('This file appears to contain an API key. It is committed to git — REMOVE IT NOW, then rotate\n     that key on the DeepSeek platform. Keys belong in:  npx wrangler secret put DEEPSEEK_API_KEY');
}

const line = '─'.repeat(72);
console.log(`\n${line}\nArguMentor Worker — pre-deploy check\n${line}`);
for (const note of notes) console.log(`  ✓ ${note}`);
for (const warning of warnings) console.log(`\n  ⚠ ${warning}`);
for (const problem of problems) console.log(`\n  ✗ ${problem}`);

if (problems.length) {
  console.log(`\n${line}\nFix the ✗ items above, then run this again.\n`);
  process.exitCode = 1;
} else {
  console.log(`\n${line}\nReady. Remaining steps:
  1.  npx wrangler secret put DEEPSEEK_API_KEY     (paste your key; it is not echoed or stored locally)
  2.  npx wrangler secret put ACCESS_CODE          (a short code you give to colleagues)
  3.  npx wrangler deploy
Then set the printed URL as the ARGUMENTOR_API repository *variable* on GitHub (DEPLOY.md, Part C).\n`);
}
