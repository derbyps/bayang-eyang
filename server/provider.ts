// One OpenAI-compatible client for both hosts: Ollama locally and DigitalOcean serverless inference.
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
      : kind === 'digitalocean'
        ? new OpenAI({ baseURL: requireEnv(env, 'DO_INFERENCE_URL'), apiKey: requireEnv(env, 'DO_INFERENCE_KEY') })
        : null;
  if (!client) throw new Error(`Unknown DALANG_PROVIDER "${kind}"`);

  return {
    async chat(req) {
      const res = await client.chat.completions.create(
        {
          model,
          temperature: req.temperature,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: req.signal },
      );
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
