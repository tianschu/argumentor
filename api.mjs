// api.mjs — talks to whichever back end is available. Errors are thrown as Error(code) with .field/.detail.
//
// Three deployments, one front end:
//   1. local      — `npm start`: same-origin /api/*, the key is in the local server (the normal case).
//   2. hosted     — a static page plus a serverless proxy that holds the key as a secret. index.html sets
//                   window.ARGUMENTOR_API = 'https://…'; requests go there instead, with an access code.
//   3. offline    — a static page with no back end at all: the pipeline runs in the browser against the
//                   offline template provider (engine.mjs). No key, no network, clearly labelled in the UI.
// The key is never in the page in any of them.
const CODE_KEY = 'argumentor-access-code';
const BASE = String(globalThis.ARGUMENTOR_API || '').replace(/\/+$/, '');
const url = path => `${BASE}${path}`;

// Set once by status(): null until probed, then the engine module in offline mode, or false when a server answered.
let engine = null;
const useEngine = async () => { if (!engine) engine = await import('./engine.mjs'); return engine; };

export function accessCode() {
  try { return sessionStorage.getItem(CODE_KEY) || ''; } catch { return ''; }
}
export function setAccessCode(code) {
  try { sessionStorage.setItem(CODE_KEY, String(code || '')); } catch { /* private mode: the code is asked again */ }
}

function headers() {
  const code = accessCode();
  return code ? { 'Content-Type': 'application/json', 'X-Access-Code': code } : { 'Content-Type': 'application/json' };
}

async function failure(response) {
  let data = {};
  try { data = await response.json(); } catch { /* not JSON */ }
  const error = new Error(data.error || 'CONNECTION_ERROR');
  error.field = data.field || '';
  error.detail = data.detail || '';
  return error;
}

// Probes for a back end once. If nothing answers, every later call runs in the browser instead.
export async function status() {
  if (engine) return engine.status();
  try {
    const response = await fetch(url('/api/status'), { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw await failure(response);
    const value = await response.json();
    engine = false;
    return value;
  } catch (error) {
    // A server that answered with an error is a real server; only an unreachable one means offline mode.
    if (error instanceof Error && error.message !== 'CONNECTION_ERROR' && !(error instanceof TypeError) && error.name !== 'TimeoutError' && error.name !== 'AbortError') throw error;
    return (await useEngine()).status();
  }
}

// AbortSignal.timeout() aborts with a TimeoutError DOMException; an explicit abort('timeout') sets a string.
const abortCode = signal => (signal?.reason === 'timeout' || signal?.reason?.name === 'TimeoutError' ? 'TIMEOUT' : 'CANCELLED');

async function postJson(path, body, signal) {
  let response;
  try {
    response = await fetch(url(path), { method: 'POST', headers: headers(), body: JSON.stringify(body), signal });
  } catch {
    throw new Error(signal?.aborted ? abortCode(signal) : 'CONNECTION_ERROR');
  }
  if (!response.ok) throw await failure(response);
  return response.json();
}

export const verify = signal => (engine ? engine.verify() : postJson('/api/verify', {}, signal));
export const dialogue = (body, signal) => (engine ? engine.dialogue(body) : postJson('/api/dialogue', body, signal));
export const revisionCheck = (body, signal) => (engine ? engine.revisionCheck(body) : postJson('/api/revision-check', body, signal));

// Streams NDJSON events from /api/review to onEvent; resolves when the stream ends.
export async function review(body, { signal, onEvent }) {
  if (engine) return engine.review(body, { signal, onEvent });
  let response;
  try {
    response = await fetch(url('/api/review'), { method: 'POST', headers: headers(), body: JSON.stringify(body), signal });
  } catch {
    throw new Error(signal?.aborted ? abortCode(signal) : 'CONNECTION_ERROR');
  }
  if (!response.ok) throw await failure(response);
  if (!response.body) throw new Error('CONNECTION_ERROR');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = line => {
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); } catch { throw new Error('CONNECTION_ERROR'); }
    if (event.type === 'error') {
      const error = new Error(event.error || 'CONNECTION_ERROR');
      error.field = event.field || '';
      throw error;
    }
    onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(handle);
    }
  } catch (error) {
    if (signal?.aborted) throw new Error(abortCode(signal));
    throw error;
  }
  buffer += decoder.decode();
  if (buffer.trim()) handle(buffer);
}
