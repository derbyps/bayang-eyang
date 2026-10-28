import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../../server/app';
import { createFakeProvider } from '../../server/fake-provider';
import { createBudget, createRateLimiter } from '../../server/limits';
import type { Provider } from '../../src/dalang/pipeline';
import { SAMPLE_CASTING, SAMPLE_STORY } from '../../src/dalang/sample';
import { validateLakon } from '../../src/script/validate';
import demo from '../../public/lakon/demo-eyang-putri.json';
import type { Lakon } from '../../src/script/schema';

const now = () => Date.UTC(2026, 9, 29, 10, 0);
function setup(provider: Provider = createFakeProvider({ delayMs: 0 })) {
  const budget = createBudget({ dailyUsd: 0.5, now });
  const record = vi.spyOn(budget, 'record');
  const app = createApp({
    provider,
    limiter: createRateLimiter({ limit: 5, windowMs: 3_600_000, now }),
    budget,
    fallback: demo as Lakon,
    seed: () => 7,
  });
  return { app, record };
}
const post = (body: unknown, init: RequestInit & { headers?: Record<string, string> } = {}) => ({
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
  ...init,
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9, 1.2.3.4', ...(init.headers ?? {}) },
});
const lines = async (res: Response) =>
  (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

describe('POST /api/dalang', () => {
  test('streams progress, the cast and a valid play as NDJSON', async () => {
    const { app } = setup();
    const res = await app.request('/api/dalang', post(SAMPLE_STORY));
    expect(res.headers.get('content-type')).toMatch(/application\/x-ndjson/);
    const events = await lines(res);
    expect(events[0]).toEqual({ type: 'progress', stage: 'casting' });
    expect(events.map((e) => e.type)).toContain('cast');
    const done = events.at(-1);
    expect(done.type).toBe('done');
    expect(validateLakon(done.lakon).ok).toBe(true);
  });

  test('requires who and hardship, and caps field length', async () => {
    const { app } = setup();
    expect((await app.request('/api/dalang', post({ ...SAMPLE_STORY, who: '' }))).status).toBe(400);
    expect((await app.request('/api/dalang', post({ ...SAMPLE_STORY, hardship: 'x'.repeat(241) }))).status).toBe(400);
  });

  test('limits count characters, and a full story in multi-byte text is accepted', async () => {
    const { app } = setup();
    const waves = (n: number) => Array.from({ length: n }, () => '🌊').join('');
    expect((await app.request('/api/dalang', post({ ...SAMPLE_STORY, hardship: waves(240) }))).status).toBe(200);
    expect((await app.request('/api/dalang', post({ ...SAMPLE_STORY, hardship: waves(241) }))).status).toBe(400);
  });

  test('refuses bodies over 4 KB', async () => {
    const { app } = setup();
    const res = await app.request('/api/dalang', post({ ...SAMPLE_STORY, pad: 'x'.repeat(5000) }));
    expect(res.status).toBe(413);
  });

  test('refuses other methods and content types', async () => {
    const { app } = setup();
    expect((await app.request('/api/dalang')).status).toBe(405);
    expect((await app.request('/api/dalang', post(SAMPLE_STORY, { headers: { 'content-type': 'text/plain' } }))).status).toBe(415);
  });

  test('behind Render and Cloudflare, the limit follows cf-connecting-ip, not forged or proxy entries', async () => {
    const { app } = setup();
    for (let i = 0; i < 5; i++) {
      // Render keeps the client's forged entries and appends a different proxy address each time.
      const h = { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7, 10.200.0.${i}`, 'cf-connecting-ip': '203.0.113.7' };
      await (await app.request('/api/dalang', post(SAMPLE_STORY, { headers: h }))).text();
    }
    const h = { 'x-forwarded-for': '7.7.7.7, 203.0.113.7, 10.200.9.9', 'cf-connecting-ip': '203.0.113.7' };
    expect(await lines(await app.request('/api/dalang', post(SAMPLE_STORY, { headers: h })))).toEqual([expect.objectContaining({ type: 'resting' })]);
    const other = { 'x-forwarded-for': '198.51.100.2, 10.200.9.9', 'cf-connecting-ip': '198.51.100.2' };
    expect((await lines(await app.request('/api/dalang', post(SAMPLE_STORY, { headers: other }))))[0]).not.toMatchObject({ type: 'resting' });
  });

  test('the sixth play in an hour from the same address rests, whatever the client claims', async () => {
    const { app } = setup();
    for (let i = 0; i < 5; i++) {
      const forged = { 'x-forwarded-for': `10.0.0.${i}, 1.2.3.4` };
      await (await app.request('/api/dalang', post(SAMPLE_STORY, { headers: forged }))).text();
    }
    const events = await lines(await app.request('/api/dalang', post(SAMPLE_STORY, { headers: { 'x-forwarded-for': '7.7.7.7, 1.2.3.4' } })));
    expect(events).toEqual([expect.objectContaining({ type: 'resting' })]);
  });

  test('client abort cancels the provider call and still records cost', async () => {
    let sawAbort = false;
    let calls = 0;
    const provider: Provider = {
      async chat(req) {
        calls++;
        if (calls === 1) return { text: JSON.stringify(SAMPLE_CASTING), usage: { input: 1000, output: 500 }, model: '@cf/google/gemma-4-26b-a4b-it' };
        return new Promise((_, reject) =>
          req.signal?.addEventListener('abort', () => {
            sawAbort = true;
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          }),
        );
      },
    };
    const { app, record } = setup(provider);
    const ctrl = new AbortController();
    const res = await app.request('/api/dalang', post(SAMPLE_STORY, { signal: ctrl.signal }));
    const reader = res.body!.getReader();
    let seen = '';
    while (!seen.includes('"cast"')) seen += new TextDecoder().decode((await reader.read()).value);
    ctrl.abort();
    await new Promise((r) => setTimeout(r, 30));
    expect(sawAbort).toBe(true);
    expect(record).toHaveBeenCalledWith(expect.closeTo((1000 * 0.1 + 500 * 0.3) / 1e6, 9));
  });
});

test('GET /api/health', async () => {
  const { app } = setup();
  expect(await (await app.request('/api/health')).json()).toEqual({ ok: true });
});
