import { expect, test } from 'vitest';
import { harvest } from '../../scripts/teacher-lib';
import { castingPrompt, scenesPrompt, systemPrompt } from '../../src/dalang/prompts';
import { SAMPLE_CASTING, SAMPLE_SCENES, SAMPLE_STORY } from '../../src/dalang/sample';

const replies = (scenes: unknown) => [`Here you go: ${JSON.stringify(SAMPLE_CASTING)}`, JSON.stringify(scenes)];

test('a clean play becomes two examples: casting and scenes, each answering the first-try prompt', () => {
  const ex = harvest(SAMPLE_STORY, replies(SAMPLE_SCENES), 7)!;
  expect(ex).toHaveLength(2);
  const [cast, scenes] = ex;
  expect(cast.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
  expect(cast.messages[0].content).toBe(systemPrompt(SAMPLE_STORY.language));
  expect(cast.messages[1].content).toBe(castingPrompt(SAMPLE_STORY));
  expect(JSON.parse(cast.messages[2].content).cast).toHaveLength(SAMPLE_CASTING.cast.length);
  expect(scenes.messages[1].content).toBe(scenesPrompt(SAMPLE_STORY, JSON.parse(cast.messages[2].content)));
  expect(JSON.parse(scenes.messages[2].content).scenes).toHaveLength(SAMPLE_SCENES.scenes.length);
  // Answers are compact, as the system prompt asks.
  expect(scenes.messages[2].content).not.toContain('\n');
});

test('the last reply that parses wins, so repaired answers become the target', () => {
  const broken = { scenes: [{ kind: 'jejer' }] };
  const ex = harvest(SAMPLE_STORY, [JSON.stringify(SAMPLE_CASTING), JSON.stringify(broken), JSON.stringify(SAMPLE_SCENES)], 7);
  expect(ex).not.toBeNull();
});

test('a play that still fails the checks teaches nothing', () => {
  const noClowns = { scenes: SAMPLE_SCENES.scenes.map((s) => ({ ...s, kind: 'jejer' as const })) };
  expect(harvest(SAMPLE_STORY, replies(noClowns), 7)).toBeNull();
  expect(harvest(SAMPLE_STORY, [JSON.stringify(SAMPLE_CASTING)], 7)).toBeNull();
});
