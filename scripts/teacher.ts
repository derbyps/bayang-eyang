// The teacher writes the apprentice's lessons: Gemma 4 invents practice stories, performs each one, and every
// play that passes the checks becomes two fine-tuning examples. Resumable; stops before the free daily allowance.
// Usage: npx tsx --env-file-if-exists=.env scripts/teacher.ts [--stories 160] [--budget 0.09] [--concurrency 3]
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import demo from '../public/lakon/demo-eyang-putri.json';
import { createProvider } from '../server/provider';
import { costOf } from '../server/limits';
import { runDalang, type Provider } from '../src/dalang/pipeline';
import { extractJson } from '../src/dalang/prompts';
import type { StoryInput } from '../src/dalang/storyboard';
import type { Lakon } from '../src/script/schema';
import evalStories from './stories.json';
import { harvest } from './teacher-lib';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const want = arg('stories', 160);
const budget = arg('budget', 0.09);
const concurrency = arg('concurrency', 3);

const DIR = 'apprentice';
const STORIES = `${DIR}/stories.json`;
const TRAIN = `${DIR}/train.jsonl`;
const DONE = `${DIR}/done.jsonl`;
mkdirSync(DIR, { recursive: true });

const provider = createProvider(process.env);
const model = provider.info?.model ?? 'unknown';
let spent = 0;
let failuresInARow = 0;

/** Counts cost, and stops everything after repeated API errors (for example the free allowance running out). */
const metered = (replies?: string[]): Provider => ({
  info: provider.info,
  async chat(req) {
    try {
      const res = await provider.chat(req);
      spent += costOf(res.model, res.usage);
      failuresInARow = 0;
      replies?.push(res.text);
      return res;
    } catch (e) {
      if (++failuresInARow >= 3) {
        console.error(`stopping: ${failuresInARow} API errors in a row (${e instanceof Error ? e.message : e})`);
        process.exit(1);
      }
      throw e;
    }
  },
});

const THEMES = [
  'farmers and fishermen in Central Java', 'traders in a Padang market', 'a family in Makassar', 'a Balinese village',
  'a Chinese-Indonesian shop in Semarang', 'a teacher in Kalimantan', 'a seamstress in Surabaya', 'a train worker in Bandung',
  'a midwife in Flores', 'a family in Ambon', 'a becak driver in Yogyakarta', 'a batik maker in Pekalongan',
  'a family that moved to Jakarta in the 1970s', 'a village in Aceh after the tsunami', 'a coffee farmer in Toraja',
  'a kroncong singer in Solo',
];
const chars = (s: unknown, max: number) => typeof s === 'string' && s.trim().length > 0 && Array.from(s.trim()).length <= max;

async function inventStories(): Promise<StoryInput[]> {
  if (existsSync(STORIES)) return JSON.parse(readFileSync(STORIES, 'utf8'));
  const taken = new Set(evalStories.map((s) => s.who.toLowerCase()));
  const stories: StoryInput[] = [];
  for (let b = 0; stories.length < want && b < THEMES.length * 2; b++) {
    const language = b % 2 ? 'id' : 'en';
    const res = await metered().chat({
      system: 'You invent short, fictional, kind family memories for a puppet-theatre writing exercise. No real people.',
      user: `Invent 10 different grandparents or elders, inspired by ${THEMES[b % THEMES.length]}. Vary names, eras, hardships (floods, illness, debt, war, moving away, losing work) and funny habits.
Write every field in ${language === 'id' ? 'Bahasa Indonesia' : 'English'}.
Answer with JSON only: {"stories":[{"who":"name and relation, under 60 characters","loved":"under 150 characters","hardship":"under 220 characters","habit":"under 150 characters"}]}`,
      temperature: 1,
      json: true,
    });
    const list = (extractJson(res.text) as { stories?: Record<string, unknown>[] } | null)?.stories ?? [];
    for (const s of list) {
      if (!chars(s.who, 60) || !chars(s.loved, 160) || !chars(s.hardship, 240) || !chars(s.habit, 160)) continue;
      const who = (s.who as string).trim();
      if (taken.has(who.toLowerCase())) continue;
      taken.add(who.toLowerCase());
      stories.push({ who, loved: (s.loved as string).trim(), hardship: (s.hardship as string).trim(), habit: (s.habit as string).trim(), language });
    }
    console.log(`invented ${stories.length} stories ($${spent.toFixed(4)})`);
  }
  writeFileSync(STORIES, `${JSON.stringify(stories.slice(0, want), null, 1)}\n`);
  return stories.slice(0, want);
}

const stories = await inventStories();
const done = new Set(existsSync(DONE) ? readFileSync(DONE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).i) : []);
let next = 0;
let kept = 0;
const worker = async () => {
  while (next < stories.length && spent < budget) {
    const i = next++;
    if (done.has(i)) continue;
    const replies: string[] = [];
    const run = await runDalang(stories[i], metered(replies), { seed: 5000 + i, fallback: demo as Lakon, onEvent: () => undefined });
    const examples = run.fallback ? null : harvest(stories[i], replies, 5000 + i);
    if (examples) {
      kept++;
      appendFileSync(TRAIN, examples.map((e) => JSON.stringify(e)).join('\n') + '\n');
    }
    appendFileSync(DONE, `${JSON.stringify({ i, ok: Boolean(examples), rounds: run.rounds })}\n`);
    console.log(`#${i} ${examples ? 'kept' : 'skipped'} (rounds ${run.rounds}) — kept ${kept}, $${spent.toFixed(4)}`);
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`${model}: kept ${kept} new plays this run, spent about $${spent.toFixed(4)}`);
