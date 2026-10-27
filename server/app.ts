// The dalang's web server: one streaming endpoint, guarded by a rate limit and a daily budget.
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { runDalang, type Provider } from '../src/dalang/pipeline';
import type { StoryInput } from '../src/dalang/storyboard';
import type { Lakon } from '../src/script/schema';
import { clientIp } from './client-ip';
import { costOf, type createBudget, type createRateLimiter } from './limits';
import { createTracer, type Tracer } from './tracing';

export interface AppDeps {
  provider: Provider;
  limiter: ReturnType<typeof createRateLimiter>;
  budget: ReturnType<typeof createBudget>;
  fallback: Lakon;
  tracer?: Tracer;
  seed?: () => number;
}

const MAX_BODY = 4096;
const chars = (max: number, min = 0) =>
  z.string().refine((s) => {
    const n = Array.from(s.trim()).length;
    return n >= min && n <= max;
  }, `must be ${min ? `${min}–` : 'at most '}${max} characters`);

const StoryInputSchema = z.object({
  who: chars(60, 1),
  loved: chars(160).default(''),
  hardship: chars(240, 1),
  habit: chars(160).default(''),
  language: z.enum(['en', 'id']).default('en'),
});

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const tracer = deps.tracer ?? createTracer();
  const seed = deps.seed ?? (() => Math.floor(Math.random() * 2 ** 31));

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.post('/api/dalang', async (c) => {
    if (!c.req.header('content-type')?.includes('application/json')) return c.json({ error: 'send JSON' }, 415);
    if (Number(c.req.header('content-length') ?? 0) > MAX_BODY) return c.json({ error: 'story too long' }, 413);
    const raw = await c.req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY) return c.json({ error: 'story too long' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid JSON' }, 400);
    }
    const parsed = StoryInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
    }
    const trim = (s: string) => s.trim();
    const story: StoryInput = {
      who: trim(parsed.data.who),
      loved: trim(parsed.data.loved),
      hardship: trim(parsed.data.hardship),
      habit: trim(parsed.data.habit),
      language: parsed.data.language,
    };

    c.header('content-type', 'application/x-ndjson; charset=utf-8');
    c.header('cache-control', 'no-store');
    const limited = deps.limiter.take(clientIp(c));
    if (!limited.ok) return c.body(`${JSON.stringify({ type: 'resting', retryAfterMin: limited.retryAfterMin })}\n`);
    if (!deps.budget.canSpend()) {
      return c.body(`${JSON.stringify({ type: 'resting', retryAfterMin: deps.budget.resetsInMin() })}\n`);
    }

    const signal = c.req.raw.signal;
    return stream(c, async (s) => {
      const write = (e: unknown) => s.write(`${JSON.stringify(e)}\n`);
      try {
        await tracer.run('dalang.run', { language: story.language, storyChars: Array.from(Object.values(story).join('')).length }, () =>
          runDalang(story, deps.provider, {
            seed: seed(),
            fallback: deps.fallback,
            signal,
            onEvent: (e) => void write(e),
            onUsage: (u) => deps.budget.record(costOf(u.model, u)),
          }),
        );
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError') && !signal.aborted) await write({ type: 'unavailable' });
      }
    });
  });

  app.all('/api/dalang', (c) => c.json({ error: 'use POST' }, 405));
  return app;
}
