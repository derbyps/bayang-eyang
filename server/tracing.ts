// Sentry agent tracing: one trace per play. Only lengths, counts, models, tokens and timings are
// ever recorded; story text and model output never leave the server.
import * as Sentry from '@sentry/node';

export interface SpanSetter {
  set(key: string, value: string | number): void;
}

export interface Tracer {
  run<T>(name: string, attrs: Record<string, string | number>, fn: (span: SpanSetter) => Promise<T>): Promise<T>;
  span<T>(name: string, attrs: Record<string, string | number>, fn: (span: SpanSetter) => T): T;
  issue(message: string, tags: Record<string, string>): void;
}

const NOOP_SPAN: SpanSetter = { set: () => undefined };
const noop: Tracer = {
  run: (_n, _a, fn) => fn(NOOP_SPAN),
  span: (_n, _a, fn) => fn(NOOP_SPAN),
  issue: () => undefined,
};

// Attribute names that could carry prompts or model output.
const SENSITIVE = /(messages|prompt|completion|response\.text|request\.body|input\.value|output\.value)/i;
// Integrations that record LLM inputs/outputs automatically; we trace model calls by hand instead.
const AI_INTEGRATIONS = /openai|anthropic|vercel|langchain|langgraph|google/i;

type Scrubbable = {
  request?: { data?: unknown; cookies?: unknown; query_string?: unknown };
  breadcrumbs?: unknown[];
  extra?: unknown;
  spans?: { data?: Record<string, unknown> }[];
  contexts?: { trace?: { data?: Record<string, unknown> } };
};

function stripData(data?: Record<string, unknown>) {
  if (!data) return;
  for (const key of Object.keys(data)) if (SENSITIVE.test(key)) delete data[key];
}

/** Removes anything that could carry a visitor's words before an event leaves the server. */
export function scrub<E extends Scrubbable>(event: E): E {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
  }
  event.breadcrumbs = [];
  delete event.extra;
  for (const span of event.spans ?? []) stripData(span.data);
  stripData(event.contexts?.trace?.data);
  return event;
}

export function createTracer(dsn?: string, transport?: Sentry.NodeOptions['transport']): Tracer {
  if (!dsn) return noop;
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
    // Collect nothing a visitor typed: Sentry 11 collects request bodies, headers and stack
    // variables by default.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    ...(transport ? { transport } : {}),
    integrations: (defaults) => defaults.filter((i) => !AI_INTEGRATIONS.test(i.name)),
    beforeSend: (e) => scrub(e),
    beforeSendTransaction: (e) => scrub(e),
  });
  const op = (name: string) => (name.startsWith('gen_ai.') ? name : 'dalang');
  return {
    run: (name, attrs, fn) =>
      Sentry.startSpan({ name, op: op(name), attributes: attrs }, (span) => fn({ set: (k, v) => span.setAttribute(k, v) })),
    span: (name, attrs, fn) =>
      Sentry.startSpan({ name, op: op(name), attributes: attrs }, (span) => fn({ set: (k, v) => span.setAttribute(k, v) })),
    issue: (message, tags) => void Sentry.captureMessage(message, { level: 'warning', tags }),
  };
}
