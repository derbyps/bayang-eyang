import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';
import { createProvider } from '../../server/provider';

const GEMMA = '@cf/google/gemma-4-26b-a4b-it';
let close: (() => void) | undefined;
afterEach(() => close?.());

/** A stand-in for Cloudflare's OpenAI-compatible endpoint that records what it was sent. */
async function stubCloudflare() {
  const seen: { path?: string; auth?: string; body?: Record<string, unknown> } = {};
  const server = createServer(async (req: IncomingMessage, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    Object.assign(seen, { path: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        id: 'x',
        object: 'chat.completion',
        created: 0,
        model: GEMMA,
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"ok":true}', reasoning_content: 'hmm' } }],
        usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  close = () => server.close();
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

test('cloudflare: calls the account endpoint with the token and thinking switched off', async () => {
  const { base, seen } = await stubCloudflare();
  const provider = createProvider({
    DALANG_PROVIDER: 'cloudflare',
    DALANG_MODEL: GEMMA,
    CF_ACCOUNT_ID: 'acct123',
    CF_API_TOKEN: 'tok-xyz',
    CF_API_BASE: base,
  });
  const res = await provider.chat({ system: 'sys', user: 'hi', temperature: 0.8, json: true });
  expect(seen.path).toBe('/accounts/acct123/ai/v1/chat/completions');
  expect(seen.auth).toBe('Bearer tok-xyz');
  expect(seen.body).toMatchObject({
    model: GEMMA,
    temperature: 0.8,
    response_format: { type: 'json_object' },
    chat_template_kwargs: { enable_thinking: false },
  });
  expect(res).toEqual({ text: '{"ok":true}', usage: { input: 12, output: 34 }, model: GEMMA });
});

test('ollama: asks for no thinking, so Qwen answers directly like the app expects', async () => {
  const { base, seen } = await stubCloudflare();
  const provider = createProvider({ DALANG_PROVIDER: 'ollama', DALANG_MODEL: 'qwen3.5:4b', OLLAMA_URL: base });
  await provider.chat({ system: 'sys', user: 'hi', temperature: 0.8, json: true });
  expect(seen.path).toBe('/v1/chat/completions');
  expect(seen.body).toMatchObject({ model: 'qwen3.5:4b', reasoning_effort: 'none' });
  expect(seen.body).not.toHaveProperty('chat_template_kwargs');
});

test('a model without JSON mode is asked again without it, and never asked for it again', async () => {
  const bodies: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    bodies.push(body);
    res.setHeader('content-type', 'application/json');
    if (body.response_format) {
      res.statusCode = 501;
      res.end(JSON.stringify({ error: { message: 'structured output is unavailable' } }));
      return;
    }
    res.end(JSON.stringify({ model: 'qwen3.5:4b', choices: [{ index: 0, message: { role: 'assistant', content: '{"ok":true}' } }] }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  close = () => server.close();
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const provider = createProvider({ DALANG_PROVIDER: 'ollama', DALANG_MODEL: 'qwen3.5:4b', OLLAMA_URL: base });
  const req = { system: 'sys', user: 'hi', temperature: 0.8, json: true };
  expect((await provider.chat(req)).text).toBe('{"ok":true}');
  expect('response_format' in bodies.at(-1)!).toBe(false);
  const sent = bodies.length;
  expect((await provider.chat(req)).text).toBe('{"ok":true}');
  expect(bodies.slice(sent).map((b) => 'response_format' in b)).toEqual([false]);
});

test('tinker: sends the exact prompt the apprentice was trained on, thinking already closed', async () => {
  const seen: { path?: string; auth?: string; body?: Record<string, unknown> } = {};
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    Object.assign(seen, { path: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ model: 'tinker://run/sampler_weights/final', choices: [{ index: 0, text: '{"ok":true}' }], usage: { prompt_tokens: 5, completion_tokens: 3 } }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  close = () => server.close();
  const provider = createProvider({
    DALANG_PROVIDER: 'tinker',
    DALANG_MODEL: 'tinker://run/sampler_weights/final',
    TINKER_API_KEY: 'tk-1',
    TINKER_OAI_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  });
  const res = await provider.chat({ system: 'SYS', user: 'USER', temperature: 0.8, json: true });
  expect(seen.path).toBe('/completions');
  expect(seen.auth).toBe('Bearer tk-1');
  expect(seen.body).toMatchObject({
    model: 'tinker://run/sampler_weights/final',
    prompt: '<|im_start|>system\nSYS<|im_end|>\n<|im_start|>user\nUSER<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n',
    stop: ['<|im_end|>'],
    temperature: 0.8,
  });
  expect(res).toEqual({ text: '{"ok":true}', usage: { input: 5, output: 3 }, model: 'tinker://run/sampler_weights/final' });
});

test('cloudflare: a missing token fails at boot, naming the variable', () => {
  expect(() => createProvider({ DALANG_PROVIDER: 'cloudflare', DALANG_MODEL: GEMMA, CF_ACCOUNT_ID: 'a' })).toThrow('CF_API_TOKEN is not set');
});

test('an unknown provider fails at boot', () => {
  expect(() => createProvider({ DALANG_PROVIDER: 'digitalocean', DALANG_MODEL: 'm' })).toThrow('Unknown DALANG_PROVIDER "digitalocean"');
});
