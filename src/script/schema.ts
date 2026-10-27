import { z } from 'zod';
import { ACTION_NAMES, MODIFIERS, PUPPET_KEYS, type Action } from './vocabulary';

const Side = z.enum(['left', 'right']);
const Temperament = z.enum(['halus', 'gagah', 'raksasa', 'punakawan']);
const Time = z.number().finite().min(0);

export const CastMemberSchema = z.strictObject({
  id: z.string().min(1),
  puppet: z.enum(PUPPET_KEYS as [string, ...string[]]),
  name: z.string().min(1),
  type: Temperament,
  home: Side.optional(),
});

export const ActionBeatSchema = z.strictObject({
  t: Time,
  actor: z.string().min(1),
  do: z.enum(ACTION_NAMES as [Action, ...Action[]]),
  style: z.string().optional(),
  target: z.string().optional(),
  from: Side.optional(),
  to: z.number().min(0).max(1).optional(),
  intensity: z.number().min(0).max(1).optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  mods: z.array(z.enum(MODIFIERS as [string, ...string[]])).optional(),
  line: z.string().min(1).optional(),
});

export const NarrateBeatSchema = z.strictObject({ t: Time, narrate: z.string().min(1) });
export const SfxBeatSchema = z.strictObject({
  t: Time,
  sfx: z.enum(['cempala-1', 'cempala-2', 'cempala-roll', 'keprak', 'gong']),
});
export const MusicBeatSchema = z.strictObject({ t: Time, music: z.enum(['calm', 'war', 'playful', 'stop']) });

export const BeatSchema = z.union([ActionBeatSchema, NarrateBeatSchema, SfxBeatSchema, MusicBeatSchema]);

export const LakonSchema = z.strictObject({
  version: z.literal(1),
  title: z.string().min(1),
  seed: z.number().int(),
  cast: z.array(CastMemberSchema).min(1),
  scenes: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        kind: z.enum(['gunungan', 'jejer', 'perang', 'gara-gara', 'tancep-kayon']),
        title: z.string().min(1),
        start: Time,
      }),
    )
    .min(1),
  beats: z.array(BeatSchema).min(1),
});

export type Lakon = z.infer<typeof LakonSchema>;
export type CastMember = z.infer<typeof CastMemberSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type ActionBeat = z.infer<typeof ActionBeatSchema>;
export type NarrateBeat = z.infer<typeof NarrateBeatSchema>;
export type SfxBeat = z.infer<typeof SfxBeatSchema>;
export type MusicBeat = z.infer<typeof MusicBeatSchema>;

export function isActionBeat(b: Beat): b is ActionBeat {
  return 'do' in b;
}
