import { expect, test } from 'vitest';
import { evaluate, toMarkdown } from '../../scripts/eval-lib';
import { createFakeProvider } from '../../server/fake-provider';
import { SAMPLE_STORY } from '../../src/dalang/sample';
import stories from '../../scripts/stories.json';

test('evaluating the fake model reports a clean run', async () => {
  const r = await evaluate(createFakeProvider({ delayMs: 0 }), [SAMPLE_STORY, SAMPLE_STORY, SAMPLE_STORY], { concurrency: 2 });
  expect(r.n).toBe(3);
  expect(r.fallbackRate).toBe(0);
  expect(r.firstTry).toBe(1);
  expect(r.avgScenes).toBe(4);
});

test('the markdown table names every metric', async () => {
  const r = await evaluate(createFakeProvider({ delayMs: 0 }), [SAMPLE_STORY], { concurrency: 1 });
  const md = toMarkdown(r);
  for (const k of ['First try', 'Avg repair rounds', 'Fallback rate', 'Moves dropped', 'p50', 'p90', 'Tokens', 'Cost', 'Scenes', 'Distinct moves', 'Puppets']) {
    expect(md).toContain(k);
  }
});

test('the eval set has 24 fictional stories in both languages', () => {
  expect(stories).toHaveLength(24);
  expect(new Set(stories.map((s: { language: string }) => s.language))).toEqual(new Set(['en', 'id']));
});
