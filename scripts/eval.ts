// Usage: DALANG_PROVIDER=ollama DALANG_MODEL=gemma4:e2b npx tsx --env-file-if-exists=.env scripts/eval.ts [--n 24] [--concurrency 2]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createProvider } from '../server/provider';
import { evaluate, toMarkdown } from './eval-lib';
import stories from './stories.json';
import type { StoryInput } from '../src/dalang/storyboard';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const n = arg('n', 24);
const concurrency = arg('concurrency', 2);
const report = await evaluate(createProvider(process.env), (stories as StoryInput[]).slice(0, n), { concurrency });
mkdirSync('eval', { recursive: true });
const slug = report.model.replace(/[^a-zA-Z0-9.-]+/g, '-');
writeFileSync(`eval/results-${slug}.json`, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(`eval/results-${slug}.md`, toMarkdown(report));
console.log(toMarkdown(report));
