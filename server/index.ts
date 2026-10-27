// Boots the dalang server. In production it also serves the built site from dist/.
import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app';
import { createBudget, createRateLimiter } from './limits';
import { createProvider } from './provider';
import { createTracer } from './tracing';
import type { Lakon } from '../src/script/schema';

const env = process.env;
const fallback = JSON.parse(readFileSync(new URL('../public/lakon/demo-eyang-putri.json', import.meta.url), 'utf8')) as Lakon;
const app = createApp({
  provider: createProvider(env),
  limiter: createRateLimiter({ limit: 5, windowMs: 3_600_000, now: Date.now }),
  budget: createBudget({ dailyUsd: Number(env.DALANG_DAILY_BUDGET_USD ?? 0.5), now: Date.now }),
  fallback,
  tracer: createTracer(env.SENTRY_DSN),
});

if (env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`dalang listening on :${port} (provider: ${env.DALANG_PROVIDER ?? 'fake'})`);
});
