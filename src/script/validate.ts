import { LakonSchema, isActionBeat, type ActionBeat, type Lakon } from './schema';
import { ACTIONS, COMBAT_MOD_ACTIONS, defaultStyle, isValidStyle } from './vocabulary';

export type RuleId =
  | 'schema'
  | 'order'
  | 'cast'
  | 'style'
  | 'needs'
  | 'gunungan'
  | 'on-stage'
  | 'repeat'
  | 'mods'
  | 'range';

export interface ValidationError {
  beat?: number;
  rule: RuleId;
  message: string;
}

export type ValidationResult = { ok: true; lakon: Lakon } | { ok: false; errors: ValidationError[] };

const MAX_T = 300;
const GUNUNGAN_ALLOWED = new Set(['enter', 'exit', 'plant', 'gunungan-open', 'gunungan-close', 'gunungan-storm']);
const REMOVES_ACTOR = new Set(['exit', 'fall']);

export function validateLakon(input: unknown): ValidationResult {
  const parsed = LakonSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join('.') || '(root)';
    return { ok: false, errors: [{ rule: 'schema', message: `${path}: ${issue.message}` }] };
  }
  const lakon = parsed.data;
  const errors: ValidationError[] = [];
  const err = (rule: RuleId, message: string, beat?: number) =>
    errors.push({ rule, message: beat === undefined ? message : `beat ${beat}: ${message}`, beat });

  const cast = new Map(lakon.cast.map((c) => [c.id, c]));
  const onStage = new Set<string>();
  const finished = new Set<string>();
  const lastAction = new Map<string, string>();

  if (lakon.scenes[0].start !== 0) err('range', 'the first scene must start at 0');
  lakon.scenes.forEach((s, i) => {
    if (i > 0 && s.start < lakon.scenes[i - 1].start) err('range', `scene "${s.id}" starts before the previous scene`);
  });

  lakon.beats.forEach((beat, i) => {
    if (beat.t > MAX_T) err('range', `t ${beat.t} is beyond ${MAX_T} seconds`, i);
    if (i > 0 && beat.t < lakon.beats[i - 1].t) err('order', `t ${beat.t} comes before the previous beat`, i);
    if (!isActionBeat(beat)) return;
    checkAction(beat, i);
  });

  function checkAction(b: ActionBeat, i: number) {
    const actor = cast.get(b.actor);
    if (!actor) {
      err('cast', `unknown actor "${b.actor}"`, i);
      return;
    }
    const def = ACTIONS[b.do];
    const style = b.style ?? defaultStyle(b.do);
    if (!isValidStyle(b.do, style)) {
      err('style', `"${style}" is not a style of ${b.do} (use ${def.styles.join(', ')})`, i);
    }
    for (const need of def.needs) {
      if (b[need] === undefined) err('needs', `${b.do} needs "${need}"`, i);
    }
    if (b.target !== undefined) {
      if (b.target === b.actor) err('cast', `"${b.actor}" cannot target itself`, i);
      else if (!cast.has(b.target)) err('cast', `unknown target "${b.target}"`, i);
      else if (!onStage.has(b.target)) err('on-stage', `target "${b.target}" is not on stage`, i);
    }

    const isGununganPuppet = actor.puppet === 'gunungan';
    const isGununganAction = def.group === 'gunungan';
    if (isGununganAction && !isGununganPuppet) err('gunungan', `only a gunungan can do ${b.do}`, i);
    if (isGununganPuppet && !GUNUNGAN_ALLOWED.has(b.do)) err('gunungan', `a gunungan cannot do ${b.do}`, i);

    if (finished.has(b.actor)) err('on-stage', `"${b.actor}" has already lingered and left the play`, i);
    else if (b.do === 'enter') {
      if (onStage.has(b.actor)) err('on-stage', `"${b.actor}" is already on stage`, i);
    } else if (!onStage.has(b.actor)) err('on-stage', `"${b.actor}" is not on stage`, i);

    const key = `${b.do}/${style}`;
    if (lastAction.get(b.actor) === key) {
      err('repeat', `"${b.actor}" uses ${key} twice in a row — choose a different style or action`, i);
    }
    lastAction.set(b.actor, key);

    if (b.mods && b.mods.length > 0) {
      if (!(COMBAT_MOD_ACTIONS as readonly string[]).includes(b.do)) err('mods', `${b.do} cannot take modifiers`, i);
      if (new Set(b.mods).size !== b.mods.length) err('mods', 'modifiers must not repeat', i);
      if (b.mods.includes('high') && b.mods.includes('low')) err('mods', 'high and low cannot be combined', i);
    }

    if (b.do === 'enter') onStage.add(b.actor);
    if (REMOVES_ACTOR.has(b.do)) onStage.delete(b.actor);
    if (b.do === 'fling' && b.target) onStage.delete(b.target);
    if (b.do === 'linger') {
      onStage.delete(b.actor);
      finished.add(b.actor);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, lakon };
}
