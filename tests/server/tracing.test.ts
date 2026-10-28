import { afterAll, describe, expect, test } from 'vitest';
import * as Sentry from '@sentry/node';
import { serve } from '@hono/node-server';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../server/app';
import { createFakeProvider } from '../../server/fake-provider';
import { createBudget, createRateLimiter } from '../../server/limits';
import { createTracer } from '../../server/tracing';
import { SAMPLE_STORY } from '../../src/dalang/sample';
import demo from '../../public/lakon/demo-eyang-putri.json';
import type { Lakon } from '../../src/script/schema';

const sent: string[] = [];
const transport = () => ({
  send: async (envelope: unknown) => {
    sent.push(JSON.stringify(envelope));
    return {};
  },
  flush: async () => true,
});

afterAll(() => Sentry.close());

describe('Sentry tracing', () => {
  test('a play produces agent spans with token counts and no story text', async () => {
    const tracer = createTracer('https://public@o0.ingest.sentry.io/0', transport);
    const now = () => Date.UTC(2026, 9, 29);
    const app = createApp({
      provider: createFakeProvider({ delayMs: 0 }),
      limiter: createRateLimiter({ limit: 5, windowMs: 3_600_000, now }),
      budget: createBudget({ dailyUsd: 0.5, now }),
      fallback: demo as Lakon,
      tracer,
      seed: () => 1,
    });
    const story = { ...SAMPLE_STORY, who: 'ZZ-SENTINEL-NAME', hardship: 'ZZ-SENTINEL-HARDSHIP' };
    const res = await app.request('/api/dalang', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(story),
    });
    await res.text();
    await Sentry.flush(2000);
    const all = sent.join('\n');
    // Sentry's AI Agents view reads these ops, names and attributes (v2 span items: {"value": ...}).
    const attr = (k: string, v: string) => `"${k}":{"value":"${v}"`;
    for (const op of ['gen_ai.invoke_agent', 'gen_ai.chat', 'gen_ai.execute_tool']) expect(all).toContain(attr('sentry.op', op));
    for (const name of ['invoke_agent Dalang', 'chat fake', 'execute_tool director', 'execute_tool checks']) expect(all).toContain(`"name":"${name}"`);
    expect(all).toContain(attr('gen_ai.agent.name', 'Dalang'));
    expect(all).toContain(attr('gen_ai.provider.name', 'fake'));
    expect(all).toContain(attr('gen_ai.request.model', 'fake'));
    expect(all).toContain(attr('gen_ai.tool.name', 'director'));
    expect(all).toContain('gen_ai.usage.input_tokens');
    expect(all).not.toContain('ZZ-SENTINEL');
  });

  test('over real HTTP, request bodies never reach Sentry', async () => {
    const tracer = createTracer('https://public@o0.ingest.sentry.io/0', transport);
    const now = () => Date.UTC(2026, 9, 29);
    const app = createApp({
      provider: createFakeProvider({ delayMs: 0 }),
      limiter: createRateLimiter({ limit: 5, windowMs: 3_600_000, now }),
      budget: createBudget({ dailyUsd: 0.5, now }),
      fallback: demo as Lakon,
      tracer,
      seed: () => 1,
    });
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise((r) => server.once('listening', r));
    const port = (server.address() as AddressInfo).port;
    sent.length = 0;
    const res = await fetch(`http://127.0.0.1:${port}/api/dalang`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...SAMPLE_STORY, who: 'ZZ-HTTP-SENTINEL', habit: 'ZZ-HTTP-SENTINEL' }),
    });
    await res.text();
    await Sentry.flush(2000);
    server.close();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.join('\n')).not.toContain('ZZ-HTTP-SENTINEL');
  });

  test('without a DSN the tracer is a no-op that still runs the work', async () => {
    const tracer = createTracer();
    expect(await tracer.run('x', {}, async () => 42)).toBe(42);
    expect(tracer.span('y', {}, () => 7)).toBe(7);
  });
});
