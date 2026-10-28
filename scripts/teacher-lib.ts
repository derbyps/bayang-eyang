// Turns the teacher's (Gemma 4's) clean plays into chat examples for fine-tuning an apprentice dalang.
import { storyChecks } from '../src/dalang/checks';
import { direct } from '../src/dalang/director';
import { castingPrompt, extractJson, scenesPrompt, systemPrompt } from '../src/dalang/prompts';
import { CastingSchema, ScenesSchema, resolveActors, type StoryInput } from '../src/dalang/storyboard';
import { validateLakon } from '../src/script/validate';

export interface ChatExample {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
}

/** The last reply that parses as the schema, or null. */
function lastParsed<T>(replies: string[], schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }): T | null {
  for (let i = replies.length - 1; i >= 0; i--) {
    const parsed = schema.safeParse(extractJson(replies[i]));
    if (parsed.success) return parsed.data;
  }
  return null;
}

/**
 * Two examples (casting, scenes) from one run's model replies, each paired with the first-try prompt so the
 * apprentice learns to answer right the first time. Null unless the final play passes every check.
 */
export function harvest(story: StoryInput, replies: string[], seed: number): ChatExample[] | null {
  const casting = lastParsed(replies, CastingSchema);
  const scenes = lastParsed(replies, ScenesSchema);
  if (!casting || !scenes) return null;
  const board = resolveActors({ ...casting, scenes: scenes.scenes });
  const d = direct(board, seed);
  if (storyChecks(board, d).length || !validateLakon(d.lakon).ok) return null;

  const system = systemPrompt(story.language);
  const example = (user: string, answer: unknown): ChatExample => ({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
      { role: 'assistant', content: JSON.stringify(answer) },
    ],
  });
  return [example(castingPrompt(story), casting), example(scenesPrompt(story, casting), { scenes: board.scenes })];
}
