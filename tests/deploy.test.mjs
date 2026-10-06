// Tests for the two key-free deployments: the in-browser engine (static site) and the hosted Worker.
// Neither test contacts DeepSeek: the Worker's provider is pointed at a stub fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONSENT_VERSION, EXAMPLE, APP_VERSION } from '../core.mjs';
import { PROMPT_VERSION } from '../prompts.mjs';
import { createMockProvider } from '../mock.mjs';
import * as engine from '../engine.mjs';

const SELF = { element: 'claim', reason: 'I think my claim is too broad here.' };

test('the browser engine runs the real pipeline with no key and no network', async () => {
  const status = await engine.status();
  assert.equal(status.live, false, 'the interface must be able to say this is not AI feedback');
  assert.equal(status.offline, true);
  assert.equal(status.promptVersion, PROMPT_VERSION);

  const events = [];
  await engine.review({ input: EXAMPLE, consent: true, consentVersion: CONSENT_VERSION, self: SELF, round: 1 }, { onEvent: event => events.push(event) });
  const roles = events.filter(event => event.type === 'result').map(event => event.role).sort();
  assert.deepEqual(roles, ['analyst', 'coordinator', 'language', 'socratic']);
  const done = events.at(-1);
  assert.equal(done.type, 'done');
  assert.equal(done.meta.live, false);
  // The integrity guard must still be enforcing anchors in the browser build.
  const analyst = events.find(event => event.type === 'result' && event.role === 'analyst').result;
  assert.ok(analyst.items.every(item => item.anchor), 'every item keeps a verified quote of the learner');
});

test('the browser engine refuses without consent, exactly like the server', async () => {
  await assert.rejects(engine.review({ input: EXAMPLE, consent: false, self: SELF }, { onEvent() {} }), /CONSENT_REQUIRED/);
  await assert.rejects(engine.review({ input: EXAMPLE, consent: true, consentVersion: 'old', self: SELF }, { onEvent() {} }), /CONSENT_REQUIRED/);
  await assert.rejects(engine.review({ input: EXAMPLE, consent: true, consentVersion: CONSENT_VERSION, self: null }, { onEvent() {} }), /SELF_ASSESSMENT_REQUIRED/);
});

test('the hosted Worker gates on access code, origin and consent, then streams a full review', async t => {
  const { default: worker } = await import('../worker/worker.mjs');
  const mock = createMockProvider();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const out = await mock.complete({ messages: JSON.parse(init.body).messages });
    return new Response(JSON.stringify({ model: 'stub-model', choices: [{ message: { content: out.content }, finish_reason: 'stop' }], usage: { total_tokens: 100 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = realFetch; });

  const env = { DEEPSEEK_API_KEY: 'stub-not-a-real-key', ACCESS_CODE: 'class-42', ALLOWED_ORIGIN: 'https://example.github.io' };
  const ctx = { waitUntil: promise => promise };
  const post = (body, headers = {}) => new Request('https://w.example/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const code = { 'X-Access-Code': 'class-42', Origin: 'https://example.github.io' };

  assert.equal((await worker.fetch(post({}), env, ctx)).status, 401, 'no access code');
  assert.equal((await worker.fetch(post({}, { 'X-Access-Code': 'wrong-code', Origin: 'https://example.github.io' }), env, ctx)).status, 401, 'wrong access code');
  assert.equal((await worker.fetch(post({}, { ...code, Origin: 'https://evil.example' }), env, ctx)).status, 403, 'other origin');
  assert.equal((await (await worker.fetch(post({ input: EXAMPLE, consent: false }, code), env, ctx)).json()).error, 'CONSENT_REQUIRED');

  const response = await worker.fetch(post({ input: EXAMPLE, consent: true, consentVersion: CONSENT_VERSION, self: SELF, round: 1 }, code), env, ctx);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.github.io');
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.filter(event => event.type === 'result').map(event => event.role).sort(), ['analyst', 'coordinator', 'language', 'socratic']);
  assert.equal(events.at(-1).meta.promptVersion, PROMPT_VERSION, 'hosted runs are traceable to the same prompts');
  assert.equal(events.at(-1).meta.appVersion, APP_VERSION);

  const unconfigured = await worker.fetch(post({}, code), { ...env, DEEPSEEK_API_KEY: '' }, ctx);
  assert.equal((await unconfigured.json()).error, 'NOT_CONFIGURED');
});

test('nothing shipped to the browser or the repo can carry an API key', async () => {
  // The static build and the Worker config are the two things that get published.
  const SECRET = /\bsk-[A-Za-z0-9]{20,}\b/;
  for (const file of ['engine.mjs', 'api.mjs', 'build-site.mjs', 'worker/worker.mjs', 'worker/wrangler.toml']) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!SECRET.test(text), `${file} must never contain a key`);
  }
  // The browser bundle must not import the provider or the server, which are the only key-aware modules.
  const browserModules = ['app.mjs', 'engine.mjs', 'api.mjs', 'orchestrator.mjs', 'prompts.mjs', 'guard.mjs', 'core.mjs', 'mock.mjs', 'report.mjs', 'teacher.mjs', 'i18n.mjs', 'html.mjs', 'diff.mjs', 'sha256.mjs'];
  for (const file of browserModules) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!/from '\.\/(provider|server|env|setup|check)\.mjs'/.test(text), `${file} must not import a key-aware module`);
    assert.ok(!/from 'node:/.test(text), `${file} must run in a browser`);
  }
});
