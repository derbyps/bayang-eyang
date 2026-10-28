// One OpenAI-compatible client for both hosts: Ollama locally and Gemma 4 on Cloudflare Workers AI.
import OpenAI from 'openai';
import type { Provider } from '../src/dalang/pipeline';
import { createFakeProvider } from './fake-provider';

export function createProvider(env: NodeJS.ProcessEnv): Provider {
  const kind = env.DALANG_PROVIDER ?? 'fake';
  if (kind === 'fake') return createFakeProvider({ delayMs: Number(env.FAKE_DELAY_MS ?? 700) });
  const model = env.DALANG_MODEL;
  if (!model) throw new Error('DALANG_MODEL is not set');
  const client =
    kind === 'ollama'
      ? new OpenAI({ baseURL: `${env.OLLAMA_URL ?? 'http://localhost:11434'}/v1`, apiKey: 'ollama' })
      : kind === 'cloudflare'
        ? new OpenAI({
            baseURL: `${env.CF_API_BASE ?? 'https://api.cloudflare.com/client/v4'}/accounts/${requireEnv(env, 'CF_ACCOUNT_ID')}/ai/v1`,
            apiKey: requireEnv(env, 'CF_API_TOKEN'),
          })
        : null;
  if (!client) throw new Error(`Unknown DALANG_PROVIDER "${kind}"`);

  // Some Ollama models (Qwen3.5) refuse JSON mode; the prompts already ask for JSON, so they are asked without it.
  let jsonMode = true;
  const create = (req: Parameters<Provider['chat']>[0]) =>
    client.chat.completions.create(
      {
        model,
        temperature: req.temperature,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        ...(req.json && jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        // Gemma 4 thinks before answering by default: 4x slower and 4x the neurons for no better JSON.
        ...(kind === 'cloudflare' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        // Ollama's spelling of the same switch; models that never think ignore it.
        ...(kind === 'ollama' ? { reasoning_effort: 'none' as const } : {}),
      },
      { signal: req.signal },
    );
  const refusesJsonMode = (e: unknown) => e instanceof OpenAI.APIError && e.status === 501 && /structured output/i.test(e.message);

  return {
    info: { provider: kind, model },
    async chat(req) {
      let res;
      try {
        res = await create(req);
      } catch (e) {
        if (!(req.json && jsonMode && refusesJsonMode(e))) throw e;
        jsonMode = false;
        res = await create(req);
      }
      return {
        text: res.choices[0]?.message?.content ?? '',
        usage: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 },
        model: res.model || model,
      };
    },
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
