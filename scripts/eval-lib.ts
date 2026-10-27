// Measures a model as the dalang: success, repairs, fallbacks, speed, cost and variety.
import demo from '../public/lakon/demo-eyang-putri.json';
import { variety } from '../src/dalang/checks';
import { runDalang, type Provider } from '../src/dalang/pipeline';
import type { StoryInput } from '../src/dalang/storyboard';
import type { Lakon } from '../src/script/schema';
import { costOf } from '../server/limits';

export interface EvalReport {
  model: string;
  n: number;
  firstTry: number;
  avgRounds: number;
  fallbackRate: number;
  avgDropped: number;
  p50ms: number;
  p90ms: number;
  avgTokens: number;
  costPerPlay: number;
  avgScenes: number;
  avgActionStyles: number;
  puppets: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

export async function evaluate(provider: Provider, stories: StoryInput[], opts: { concurrency: number }): Promise<EvalReport> {
  const results: Awaited<ReturnType<typeof runDalang>>[] = [];
  let next = 0;
  const worker = async () => {
    while (next < stories.length) {
      const i = next++;
      results[i] = await runDalang(stories[i], provider, { seed: 1000 + i, fallback: demo as Lakon, onEvent: () => undefined });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));

  const real = results.filter((r) => !r.fallback);
  const v = real.map((r) => variety(r.lakon));
  const model = results.find((r) => r.model)?.model ?? 'unknown';
  return {
    model,
    n: results.length,
    firstTry: results.filter((r) => !r.fallback && r.rounds === 0).length / results.length,
    avgRounds: mean(results.map((r) => r.rounds)),
    fallbackRate: results.filter((r) => r.fallback).length / results.length,
    avgDropped: mean(real.map((r) => r.dropped)),
    p50ms: pct(results.map((r) => r.ms), 0.5),
    p90ms: pct(results.map((r) => r.ms), 0.9),
    avgTokens: mean(results.map((r) => r.tokens.input + r.tokens.output)),
    costPerPlay: mean(results.map((r) => costOf(r.model, r.tokens))),
    avgScenes: mean(v.map((x) => x.scenes)),
    avgActionStyles: mean(v.map((x) => x.actionStyles)),
    puppets: mean(v.map((x) => x.puppets)),
  };
}

export function toMarkdown(r: EvalReport): string {
  const p = (x: number) => `${Math.round(x * 100)}%`;
  const rows: [string, string][] = [
    ['Stories', String(r.n)],
    ['First try (no repair, no fallback)', p(r.firstTry)],
    ['Avg repair rounds', r.avgRounds.toFixed(2)],
    ['Fallback rate', p(r.fallbackRate)],
    ['Moves dropped (avg)', r.avgDropped.toFixed(2)],
    ['Time p50 / p90', `${(r.p50ms / 1000).toFixed(1)} s / ${(r.p90ms / 1000).toFixed(1)} s`],
    ['Tokens per play (avg)', Math.round(r.avgTokens).toString()],
    ['Cost per play', `$${r.costPerPlay.toFixed(4)}`],
    ['Scenes per play (avg)', r.avgScenes.toFixed(1)],
    ['Distinct moves per play (avg)', r.avgActionStyles.toFixed(1)],
    ['Puppets per play (avg)', r.puppets.toFixed(1)],
  ];
  return `### ${r.model}\n\n| Metric | Value |\n| --- | --- |\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n`;
}
