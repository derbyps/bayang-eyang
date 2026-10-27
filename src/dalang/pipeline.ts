// The dalang at work: cast, write the scenes, direct, check, repair, and never leave the screen empty.
import type { Lakon } from '../script/schema';
import { validateLakon } from '../script/validate';
import { storyChecks } from './checks';
import { MIN_LEN, direct } from './director';
import { castingPrompt, extractJson, repairPrompt, scenesPrompt, systemPrompt } from './prompts';
import { CastingSchema, ScenesSchema, type Casting, type Storyboard, type StoryInput } from './storyboard';
import type { ZodType } from 'zod';

export interface Provider {
  chat(req: {
    system: string;
    user: string;
    temperature: number;
    json: boolean;
    signal?: AbortSignal;
  }): Promise<{ text: string; usage: { input: number; output: number }; model: string }>;
}

export type DalangEvent =
  | { type: 'progress'; stage: 'casting' | 'scenes' | 'checking' | 'repairing' }
  | { type: 'cast'; title: string; cast: { name: string; puppet: string; role: string; why: string }[] }
  | { type: 'repair'; round: number; problems: number }
  | { type: 'done'; lakon: Lakon; meta: DalangMeta };

export interface DalangMeta {
  model: string;
  rounds: number;
  dropped: number;
  ms: number;
  tokens: { input: number; output: number };
  fallback: boolean;
}

export interface DalangOptions {
  seed: number;
  fallback: Lakon;
  onEvent(e: DalangEvent): void;
  signal?: AbortSignal;
  now?: () => number;
  /** Called after every model call with its usage (for budgets and tracing). */
  onUsage?(u: { model: string; input: number; output: number }): void;
  /** Optional tracing wrapper for the director and the checks. */
  span?<T>(name: string, attrs: Record<string, string | number>, fn: (s: { set(k: string, v: string | number): void }) => T): T;
}

const MAX_ROUNDS = 2;
const TEMP = { casting: 0.8, scenes: 0.9, repair: 0.4 };

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

export async function runDalang(story: StoryInput, provider: Provider, opts: DalangOptions): Promise<DalangMeta & { lakon: Lakon }> {
  const now = opts.now ?? (() => Date.now());
  const span = opts.span ?? ((_n, _a, fn) => fn({ set: () => undefined }));
  const started = now();
  const system = systemPrompt(story.language);
  const tokens = { input: 0, output: 0 };
  let model = '';
  let rounds = 0;

  const call = async (user: string, temperature: number) => {
    const res = await provider.chat({ system, user, temperature, json: true, signal: opts.signal });
    tokens.input += res.usage.input;
    tokens.output += res.usage.output;
    model = res.model;
    opts.onUsage?.({ model: res.model, ...res.usage });
    return res.text;
  };

  const finish = (lakon: Lakon, extra: { dropped: number; fallback: boolean }) => {
    const meta: DalangMeta = { model, rounds, tokens, ms: now() - started, ...extra };
    opts.onEvent({ type: 'done', lakon, meta });
    return { ...meta, lakon };
  };
  const fallBack = () => finish(opts.fallback, { dropped: 0, fallback: true });

  /** Asks, then repairs schema failures, up to MAX_ROUNDS. Null if it never parses. */
  async function ask<T>(user: string, temperature: number, schema: ZodType<T>, beforeRepair: (problems: number) => void) {
    let text = await call(user, temperature);
    for (let round = 0; ; round++) {
      const json = extractJson(text);
      const parsed = json === null ? null : schema.safeParse(json);
      if (parsed?.success) return { value: parsed.data, raw: json };
      const problems =
        json === null
          ? ['Your answer was not a JSON object. Answer with JSON only.']
          : parsed!.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
      if (round >= MAX_ROUNDS) return null;
      beforeRepair(problems.length);
      text = await call(repairPrompt(json ?? text, problems), TEMP.repair);
    }
  }

  const repairEvent = (problems: number) => {
    rounds++;
    opts.onEvent({ type: 'repair', round: rounds, problems });
    opts.onEvent({ type: 'progress', stage: 'repairing' });
  };

  try {
    opts.onEvent({ type: 'progress', stage: 'casting' });
    const cast = await ask<Casting>(castingPrompt(story), TEMP.casting, CastingSchema, repairEvent);
    if (!cast) return fallBack();
    const casting = cast.value;
    opts.onEvent({
      type: 'cast',
      title: casting.title,
      cast: casting.cast.map((c) => ({ name: c.name, puppet: c.puppet, role: c.role, why: c.why })),
    });

    opts.onEvent({ type: 'progress', stage: 'scenes' });
    const scenesRounds = rounds;
    let text = await call(scenesPrompt(story, casting), TEMP.scenes);
    let last: Storyboard | null = null;
    for (;;) {
      const json = extractJson(text);
      const parsed = json === null ? null : ScenesSchema.safeParse(json);
      let problems: string[];
      if (parsed?.success) {
        last = { ...casting, scenes: parsed.data.scenes };
        opts.onEvent({ type: 'progress', stage: 'checking' });
        const board = last;
        const d = span('dalang.direct', { scenes: board.scenes.length }, (s) => {
          const out = direct(board, opts.seed);
          s.set('duration_s', Math.round(out.duration));
          s.set('notes', out.notes.length);
          return out;
        });
        problems = span('dalang.check', {}, (s) => {
          const v = validateLakon(d.lakon);
          const found = [...storyChecks(board, d), ...(v.ok ? [] : v.errors.map((e) => e.message))];
          s.set('problems', found.length);
          return found;
        });
        if (!problems.length) return finish(d.lakon, { dropped: 0, fallback: false });
      } else {
        problems =
          json === null
            ? ['Your answer was not a JSON object. Answer with JSON only.']
            : parsed!.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
      }
      if (rounds - scenesRounds >= MAX_ROUNDS) break;
      repairEvent(problems.length);
      text = await call(repairPrompt(json ?? text, problems), TEMP.repair);
    }

    // Out of repairs: keep only the moves that work, and perform those.
    if (!last) return fallBack();
    const first = direct(last, opts.seed);
    const bad = new Set(first.notes.filter((n) => n.kind !== 'unknown-style' && n.kind !== 'trimmed').map((n) => `${n.scene}:${n.move}`));
    const cleaned: Storyboard = {
      ...last,
      scenes: last.scenes
        .map((s, si) => ({ ...s, moves: s.moves.filter((_, mi) => !bad.has(`${si}:${mi}`)) }))
        .filter((s) => s.moves.length >= 3),
    };
    const d = direct(cleaned, opts.seed);
    if (!cleaned.scenes.length || !validateLakon(d.lakon).ok || d.duration < MIN_LEN) return fallBack();
    return finish(d.lakon, { dropped: bad.size, fallback: false });
  } catch (e) {
    if (isAbort(e) || opts.signal?.aborted) throw e;
    return fallBack();
  }
}
