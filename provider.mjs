// provider.mjs — DeepSeek chat-completions adapter.
// Never logs the key, learner text, or provider response bodies. Errors are reduced to stable codes.

export class ProviderError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ProviderError';
    this.status = status;
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('ABORTED'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason ?? new Error('ABORTED')); }, { once: true });
  });
}

export function providerErrorCode(status, body = '') {
  if ((status === 400 || status === 404) && /model\s*not\s*exist|model_not_found|does not exist|unknown model/i.test(body)) return 'MODEL_NOT_FOUND';
  if (status === 401 || status === 403) return 'KEY_REJECTED';
  if (status === 402) return 'NO_BALANCE';
  if (status === 429) return 'PROVIDER_LIMIT';
  if (status === 400 || status === 422) return 'PROVIDER_REJECTED_REQUEST';
  return 'PROVIDER_ERROR';
}

export function createDeepSeekProvider({ key, model, baseUrl = 'https://api.deepseek.com', thinking = 'disabled', fetchImpl = globalThis.fetch }) {
  if (!key) throw new ProviderError('NOT_CONFIGURED');
  const auth = { Authorization: `Bearer ${key}` };

  async function post(body, signal) {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(body),
        signal
      });
      if (response.ok) return response.json();
      const text = await response.text().catch(() => '');
      // One retry for rate limits and transient server errors; these responses are not billed as completions.
      if (attempt === 0 && RETRYABLE.has(response.status)) { await wait(response.status === 429 ? 2500 : 1200, signal); continue; }
      throw new ProviderError(providerErrorCode(response.status, text), response.status);
    }
  }

  return {
    name: 'DeepSeek',
    model,
    live: true,
    async complete({ messages, temperature = 0.3, maxTokens = 1800, json = true, signal }) {
      const body = { model, messages, stream: false, temperature, max_tokens: maxTokens };
      if (json) body.response_format = { type: 'json_object' };
      if (thinking === 'disabled' || thinking === 'enabled') body.thinking = { type: thinking };
      const started = Date.now();
      const result = await post(body, signal);
      const choice = result.choices?.[0];
      return {
        content: typeof choice?.message?.content === 'string' ? choice.message.content : '',
        finishReason: String(choice?.finish_reason || ''),
        servedModel: String(result.model || model),
        usage: {
          prompt: Number(result.usage?.prompt_tokens || 0),
          completion: Number(result.usage?.completion_tokens || 0),
          total: Number(result.usage?.total_tokens || 0),
          cacheHit: Number(result.usage?.prompt_cache_hit_tokens || 0)
        },
        ms: Date.now() - started
      };
    },
    // GET /models costs no tokens; used for the free connection self-test.
    async listModels({ signal } = {}) {
      const response = await fetchImpl(`${baseUrl}/models`, { headers: auth, signal });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ProviderError(providerErrorCode(response.status, text), response.status);
      }
      const data = await response.json();
      return (Array.isArray(data.data) ? data.data : []).map(item => String(item.id || '')).filter(Boolean).sort();
    }
  };
}
