// What the dalang (the model) writes: casting first, then scenes. Timing belongs to the director.
import { z } from 'zod';
import { ACTION_NAMES, type Action, type PuppetKey, type Temperament } from '../script/vocabulary';

const DIRECTOR_ACTIONS = new Set<Action>(['enter', 'exit', 'linger', 'gunungan-open', 'gunungan-close', 'gunungan-storm']);
export const STORY_ACTIONS: Action[] = ACTION_NAMES.filter((a) => !DIRECTOR_ACTIONS.has(a));

export type Role = 'hero' | 'ally' | 'trouble' | 'clown' | 'elder';
export type Language = 'en' | 'id';
export type CastPuppet = Exclude<PuppetKey, 'gunungan'>;

const CastRoleSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,23}$/),
  name: z.string().min(1).max(32),
  puppet: z.enum(['semar', 'petruk', 'bagong', 'raksasa', 'eyang-putri']),
  type: z.enum(['halus', 'gagah', 'raksasa', 'punakawan']),
  role: z.enum(['hero', 'ally', 'trouble', 'clown', 'elder']),
  why: z.string().min(1).max(90),
});

export const CastingSchema = z
  .strictObject({
    title: z.string().min(1).max(60),
    language: z.enum(['en', 'id']),
    cast: z.array(CastRoleSchema).min(2).max(6),
  })
  .refine((c) => c.cast.filter((r) => r.role === 'hero').length === 1, { message: 'the cast needs exactly one hero', path: ['cast'] })
  .refine((c) => new Set(c.cast.map((r) => r.id)).size === c.cast.length, { message: 'cast ids must be unique', path: ['cast'] });

// do/style/mods stay plain strings so unknown values can be reported back by name.
const StoryMoveSchema = z.strictObject({
  who: z.string().min(1),
  do: z.string().min(1),
  style: z.string().optional(),
  target: z.string().optional(),
  mods: z.array(z.string()).optional(),
  line: z.string().min(1).max(140).optional(),
});

const StorySceneSchema = z.strictObject({
  kind: z.enum(['jejer', 'perang', 'gara-gara']),
  title: z.string().min(1).max(32),
  narration: z.array(z.string().min(1).max(200)).min(1).max(3),
  moves: z.array(StoryMoveSchema).min(3).max(10),
});

export const ScenesSchema = z.strictObject({ scenes: z.array(StorySceneSchema).min(3).max(9) });

export type CastRole = z.infer<typeof CastRoleSchema> & { puppet: CastPuppet; type: Temperament; role: Role };
export type Casting = z.infer<typeof CastingSchema>;
export type StoryMove = z.infer<typeof StoryMoveSchema>;
export type StoryScene = z.infer<typeof StorySceneSchema>;
export type Storyboard = Casting & { scenes: StoryScene[] };

export interface StoryInput {
  who: string;
  loved: string;
  hardship: string;
  habit: string;
  language: Language;
}
