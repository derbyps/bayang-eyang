// What the dalang (the model) writes: casting first, then scenes. Timing belongs to the director.
import { z } from 'zod';
import { ACTION_NAMES, type Action, type PuppetKey, type Temperament } from '../script/vocabulary';

const DIRECTOR_ACTIONS = new Set<Action>(['enter', 'exit', 'linger', 'gunungan-open', 'gunungan-close', 'gunungan-storm']);
export const STORY_ACTIONS: Action[] = ACTION_NAMES.filter((a) => !DIRECTOR_ACTIONS.has(a));

export type Role = 'hero' | 'ally' | 'trouble' | 'clown' | 'elder';
export type Language = 'en' | 'id';
export type CastPuppet = Exclude<PuppetKey, 'gunungan'>;

/** Shortens text over max code points at a word boundary, ending in "…", instead of failing the whole answer. */
export function clip(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join('');
  const head = chars.slice(0, max - 1).join('');
  const whole = /\s/.test(chars[max - 1]) ? head : head.replace(/\s+\S*$/, '');
  return `${(whole || head).replace(/[\s,.;:!?-]+$/, '')}…`;
}
const clipped = (max: number) => z.string().min(1).transform((s) => clip(s, max));

const CastRoleSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,23}$/),
  name: clipped(32),
  puppet: z.enum(['semar', 'petruk', 'bagong', 'raksasa', 'eyang-putri']),
  type: z.enum(['halus', 'gagah', 'raksasa', 'punakawan']),
  role: z.enum(['hero', 'ally', 'trouble', 'clown', 'elder']),
  why: clipped(90),
});

export const CastingSchema = z
  .object({
    title: clipped(60),
    language: z.enum(['en', 'id']),
    cast: z.array(CastRoleSchema).min(2).max(6),
  })
  .refine((c) => c.cast.filter((r) => r.role === 'hero').length === 1, { message: 'the cast needs exactly one hero', path: ['cast'] })
  .refine((c) => new Set(c.cast.map((r) => r.id)).size === c.cast.length, { message: 'cast ids must be unique', path: ['cast'] });

/** Models fill every field of the example; an empty line, target or mods list means "none". */
const dropEmpty = (m: unknown) => {
  if (!m || typeof m !== 'object') return m;
  const out: Record<string, unknown> = { ...m };
  if (out.target === undefined && typeof out.to === 'string') out.target = out.to;
  for (const k of ['line', 'target', 'style']) if (out[k] === '') delete out[k];
  if (Array.isArray(out.mods) && out.mods.length === 0) delete out.mods;
  return out;
};

// do/style/mods stay plain strings so unknown values can be reported back by name.
const StoryMoveSchema = z.preprocess(dropEmpty, z.object({
  who: z.string().min(1),
  do: z.string().min(1),
  style: z.string().optional(),
  target: z.string().optional(),
  mods: z.array(z.string()).optional(),
  line: z.string().min(1).max(140).optional(),
}));

const StorySceneSchema = z.object({
  kind: z.enum(['jejer', 'perang', 'gara-gara']),
  title: clipped(32),
  narration: z.array(z.string().min(1).max(200)).min(1).max(3),
  moves: z.array(StoryMoveSchema).min(3).max(10),
});

export const ScenesSchema = z.object({ scenes: z.array(StorySceneSchema).min(3).max(9) });

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

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Models often name a character by its display name or its puppet ("eyang-putri") instead of its id.
 * Maps those to the cast id when the match is unambiguous; anything else is left for the checks to report.
 */
export function resolveActors(sb: Storyboard): Storyboard {
  const cast = withUncastClowns(sb);
  sb = { ...sb, cast };
  const ids = new Set(sb.cast.map((c) => c.id));
  const alias = new Map<string, string | null>();
  const add = (key: string, id: string) => alias.set(key, alias.has(key) && alias.get(key) !== id ? null : id);
  for (const c of sb.cast) {
    add(slug(c.name), c.id);
    add(c.puppet, c.id);
  }
  const resolve = (who: string) => (ids.has(who) ? who : (alias.get(slug(who)) ?? who));
  return {
    ...sb,
    scenes: sb.scenes.map((s) => ({
      ...s,
      moves: s.moves.map((m) => ({ ...m, who: resolve(m.who), ...(m.target ? { target: resolve(m.target) } : {}) })),
    })),
  };
}

const CLOWNS = ['semar', 'petruk', 'bagong'] as const;

/** In wayang the clown-servants wander in freely: a clown who acts but was never cast joins the cast. */
function withUncastClowns(sb: Storyboard): Storyboard['cast'] {
  const cast = [...sb.cast];
  const named = (who: string) => cast.some((c) => c.id === who || c.puppet === who || slug(c.name) === slug(who));
  for (const m of sb.scenes.flatMap((s) => s.moves)) {
    for (const who of [m.who, m.target]) {
      const key = who && slug(who);
      const clown = CLOWNS.find((p) => p === key);
      if (clown && !named(clown) && cast.length < 6) {
        cast.push({ id: clown, name: clown[0].toUpperCase() + clown.slice(1), puppet: clown, type: 'punakawan', role: 'clown', why: 'wandered in, as clowns do' });
      }
    }
  }
  return cast;
}
