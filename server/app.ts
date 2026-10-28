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

const STEP: Record<number, string> = { 0.8: 'casting', 0.9: 'scenes', 0.4: 'repair' };

/** Wraps every model call in a gen_ai span with model, tokens and estimated cost. */
function traceProvider(provider: Provider, tracer: Tracer): Provider {
  return {
    chat: (req) =>
      tracer.run('gen_ai.chat', { 'dalang.step': STEP[req.temperature] ?? 'other', 'gen_ai.request.temperature': req.temperature }, async (span) => {
        const res = await provider.chat(req);
        span.set('gen_ai.request.model', res.model);
        span.set('gen_ai.usage.input_tokens', res.usage.input);
        span.set('gen_ai.usage.output_tokens', res.usage.output);
        span.set('dalang.cost_usd', costOf(res.model, res.usage));
        return res;
      }),
  };
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const tracer = deps.tracer ?? createTracer();
  const seed = deps.seed ?? (() => Math.floor(Math.random() * 2 ** 31));

  app.get('/api/health', (c) => c.json({ ok: true }));
  // TEMPORARY probe (remove after checking Render's proxy headers): echoes only the caller's own address headers.
  app.get('/api/whoami', (c) => {
    const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
    const pick = ['x-forwarded-for', 'cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'forwarded', 'x-envoy-external-address', 'rndr-id'];
    return c.json({ ...Object.fromEntries(pick.map((h) => [h, c.req.header(h) ?? null])), socket: incoming?.socket?.remoteAddress ?? null });
  });

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
    const provider = traceProvider(deps.provider, tracer);
    return stream(c, async (s) => {
      const write = (e: unknown) => s.write(`${JSON.stringify(e)}\n`);
      let lastProblems = Infinity;
      let model = '';
      try {
        await tracer.run('dalang.run', { language: story.language, story_chars: Array.from(Object.values(story).join('')).length }, async (root) => {
          const result = await runDalang(story, provider, {
            seed: seed(),
            fallback: deps.fallback,
            signal,
            span: (name, attrs, fn) => tracer.span(name, attrs, fn),
            onEvent: (e) => {
              if (e.type === 'repair') {
                if (e.problems >= lastProblems) tracer.issue('repair did not reduce problems', { model });
                lastProblems = e.problems;
              }
              void write(e);
            },
            onUsage: (u) => {
              model = u.model;
              deps.budget.record(costOf(u.model, u));
            },
          });
          root.set('rounds', result.rounds);
          root.set('dropped', result.dropped);
          root.set('fallback', String(result.fallback));
          root.set('gen_ai.usage.input_tokens', result.tokens.input);
          root.set('gen_ai.usage.output_tokens', result.tokens.output);
          if (result.fallback) tracer.issue('dalang fell back', { model: result.model || 'none' });
        });
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError') && !signal.aborted) await write({ type: 'unavailable' });
      }
    });
  });

  app.all('/api/dalang', (c) => c.json({ error: 'use POST' }, 405));
  return app;
}
