// The director: turns the dalang's storyboard into a timed, valid lakon. Pure and deterministic.
import { speakDuration } from '../choreo/cues';
import { applyModifiers } from '../choreo/modifiers';
import { hashSeed, mulberry32 } from '../choreo/rng';
import { TEMPERAMENTS } from '../choreo/temperament';
import { getTemplate } from '../choreo/templates';
import type { ActionBeat, Beat, CastMember, Lakon } from '../script/schema';
import { ACTIONS, COMBAT_MOD_ACTIONS, MODIFIERS, defaultStyle, isValidStyle, type Action, type Modifier, type Side, type Temperament } from '../script/vocabulary';
import { STORY_ACTIONS, type CastRole, type Storyboard, type StoryMove } from './storyboard';

export const GAP = 0.25;
export const MAX_ON_STAGE = 4;
export const MIN_LEN = 60;
export const MAX_LEN = 120;
/** Spacing margin over the template estimate: compile jitters each phase by up to ±12%. */
const JITTER_MARGIN = 1.12;
const GUNUNGAN = 'gunungan';
const HERO_SIDE_ROLES = new Set(['hero', 'ally', 'elder']);
const SLOTS: Record<number, number[]> = {
  1: [0.5],
  2: [0.3, 0.7],
  3: [0.22, 0.5, 0.78],
  4: [0.16, 0.38, 0.62, 0.84],
};
const MUSIC = { jejer: 'calm', perang: 'war', 'gara-gara': 'playful' } as const;

export type DirectorNoteKind = 'unknown-style' | 'unknown-action' | 'unknown-actor' | 'dropped' | 'trimmed';
export interface DirectorNote {
  kind: DirectorNoteKind;
  scene: number;
  move: number;
  detail: string;
}
export interface Directed {
  lakon: Lakon;
  notes: DirectorNote[];
  duration: number;
}

/** Seconds a move takes before jitter: the template's phases (with modifiers) scaled by temperament. */
export function estimateMove(action: Action, style: string, type: Temperament, mods: Modifier[]): number {
  const tpl = applyModifiers(getTemplate(action, style), mods, () => 0.5);
  return tpl.phases.reduce((n, p) => n + p.dur, 0) * TEMPERAMENTS[type].timeScale;
}

const actorId = (castId: string) => `c-${castId}`;
const DIRECTOR_OWNED = new Set(['enter', 'exit', 'linger', 'gunungan-open', 'gunungan-close', 'gunungan-storm']);
const STORY_ACTION_SET = new Set<string>(STORY_ACTIONS);

/** Directs the storyboard, trimming middle moves until the play fits in two minutes. */
export function direct(sb: Storyboard, seed: number): Directed {
  const skip = new Set<string>();
  let d = build(sb, seed, skip);
  const trimmed: DirectorNote[] = [];
  while (d.duration > MAX_LEN) {
    const victim = pickTrim(sb, skip);
    if (!victim) break;
    skip.add(`${victim.scene}:${victim.move}`);
    trimmed.push({ kind: 'trimmed', ...victim, detail: `dropped to keep the play under ${MAX_LEN} s` });
    d = build(sb, seed, skip);
  }
  return { ...d, notes: [...d.notes, ...trimmed] };
}

/** The middle-most droppable move of the scene with the most kept moves: never the first, last, or a speech. */
function pickTrim(sb: Storyboard, skip: Set<string>): { scene: number; move: number } | null {
  const kept = sb.scenes.map((s, si) => s.moves.map((_, mi) => mi).filter((mi) => !skip.has(`${si}:${mi}`)));
  const order = kept.map((k, si) => [si, k.length] as const).sort((a, b) => b[1] - a[1]);
  for (const [si] of order) {
    const k = kept[si];
    const candidates = k.slice(1, -1).filter((mi) => sb.scenes[si].moves[mi].do !== 'speak');
    if (!candidates.length) continue;
    const mid = k[Math.floor(k.length / 2)];
    candidates.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    return { scene: si, move: candidates[0] };
  }
  return null;
}

function build(sb: Storyboard, seed: number, skip: Set<string>): Directed {
  const rand = mulberry32(hashSeed(seed, 'director'));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const notes: DirectorNote[] = [];
  const beats: Beat[] = [];
  const scenes: Lakon['scenes'] = [];

  const roles = new Map<string, CastRole>(sb.cast.map((c) => [actorId(c.id), c as CastRole]));
  const types = new Map<string, Temperament>([[GUNUNGAN, 'gagah']]);
  for (const [id, c] of roles) types.set(id, c.type);

  const onStage: string[] = [];
  const side = new Map<string, Side>();
  const slotOf = new Map<string, number>();
  const busyUntil = new Map<string, number>();
  const lastKey = new Map<string, string>();
  let t = 0;

  const est = (b: ActionBeat) =>
    estimateMove(b.do, b.style ?? defaultStyle(b.do), types.get(b.actor) ?? 'gagah', (b.mods ?? []) as Modifier[]);

  /** Places an action beat at `at` and returns when the actor is free again. */
  const place = (b: Omit<ActionBeat, 't'>, at: number): number => {
    const beat = { t: round(at), ...b } as ActionBeat;
    beat.style = beat.style ?? defaultStyle(beat.do);
    beats.push(beat);
    lastKey.set(beat.actor, `${beat.do}/${beat.style}`);
    let dur = est(beat) * JITTER_MARGIN;
    if (beat.do === 'speak' && beat.line) dur = Math.max(dur, speakDuration(beat.line));
    busyUntil.set(beat.actor, at + dur);
    return at + dur;
  };

  const layout = (at: number) => {
    const left = onStage.filter((id) => side.get(id) === 'left');
    const right = onStage.filter((id) => side.get(id) === 'right');
    const order = [...left, ...right];
    const slots = SLOTS[order.length] ?? SLOTS[MAX_ON_STAGE];
    order.forEach((id, i) => {
      const to = slots[i];
      if (slotOf.get(id) === to) return;
      const was = slotOf.has(id);
      slotOf.set(id, to);
      if (!was) return; // newcomers walk straight to their slot on entry
      const style = lastKey.get(id) === 'plant/firm' ? 'light' : 'firm';
      place({ actor: id, do: 'plant', style, to }, at);
    });
  };

  const exitActor = (id: string, at: number): number => {
    const i = onStage.indexOf(id);
    if (i >= 0) onStage.splice(i, 1);
    slotOf.delete(id);
    const role = roles.get(id)?.role;
    return place({ actor: id, do: 'exit', style: role === 'clown' ? pick(['glide', 'flee'] as const) : 'glide' }, at);
  };

  /** Brings an actor on stage before their move; returns the time the stage is ready. */
  const ensureOn = (id: string, keep: string[], at: number): number => {
    if (onStage.includes(id)) return at;
    let ready = at;
    if (onStage.length >= MAX_ON_STAGE) {
      const idle = onStage.filter((x) => !keep.includes(x)).sort((a, b) => (busyUntil.get(a) ?? 0) - (busyUntil.get(b) ?? 0))[0];
      ready = Math.max(ready, exitActor(idle, at));
    }
    const role = roles.get(id)!.role;
    const leftCount = onStage.filter((x) => side.get(x) === 'left').length;
    const s: Side =
      role === 'trouble' ? 'right' : HERO_SIDE_ROLES.has(role) ? 'left' : leftCount <= onStage.length - leftCount ? 'left' : 'right';
    side.set(id, s);
    onStage.push(id);
    layout(at);
    const style = role === 'trouble' ? pick(['leap', 'glide'] as const) : role === 'clown' ? pick(['leap', 'sneak'] as const) : 'glide';
    const done = place({ actor: id, do: 'enter', from: s, to: slotOf.get(id)!, style }, at);
    return Math.max(ready, done);
  };

  const removeFromStage = (id: string) => {
    const i = onStage.indexOf(id);
    if (i >= 0) onStage.splice(i, 1);
    slotOf.delete(id);
  };

  // Opening: the gunungan opens the play.
  scenes.push({ id: 'gunungan', kind: 'gunungan', title: 'Gunungan', start: 0 });
  beats.push({ t: 0, music: 'calm' }, { t: 0, sfx: 'gong' });
  t = place({ actor: GUNUNGAN, do: 'enter', from: 'left', to: 0.5, style: 'glide' }, 0.2) + GAP;
  t = place({ actor: GUNUNGAN, do: 'gunungan-open', style: pick(['spin', 'rise'] as const) }, t) + GAP;
  if (sb.scenes[0]?.kind === 'perang') t = place({ actor: GUNUNGAN, do: 'gunungan-storm', style: pick(['wind', 'fire'] as const) }, t) + GAP;
  t = place({ actor: GUNUNGAN, do: 'exit', style: 'glide' }, t) + GAP;

  sb.scenes.forEach((scene, si) => {
    scenes.push({ id: `s${si + 1}`, kind: scene.kind, title: scene.title, start: round(t) });
    beats.push({ t: round(t), music: MUSIC[scene.kind] });
    for (const line of scene.narration) {
      beats.push({ t: round(t), narrate: line });
      t += speakDuration(line);
    }
    scene.moves.forEach((m: StoryMove, mi) => {
      if (skip.has(`${si}:${mi}`)) return;
      const note = (kind: DirectorNoteKind, detail: string) => notes.push({ kind, scene: si, move: mi, detail });
      if (DIRECTOR_OWNED.has(m.do)) return;
      if (!STORY_ACTION_SET.has(m.do)) return note('unknown-action', `"${m.do}" is not a move`);
      const action = m.do as Action;
      const actor = actorId(m.who);
      if (!roles.has(actor)) return note('unknown-actor', `"${m.who}" is not in the cast`);
      const needsTarget = (ACTIONS[action].needs as readonly string[]).includes('target');
      const target = m.target && roles.has(actorId(m.target)) && m.target !== m.who ? actorId(m.target) : undefined;
      if (m.target && !target && needsTarget) return note('unknown-actor', `target "${m.target}" is not in the cast`);
      if (needsTarget && !target) return note('dropped', `${action} needs a target`);
      if (action === 'speak' && !m.line) return note('dropped', 'speak needs a line');

      let style = m.style ?? defaultStyle(action);
      if (!isValidStyle(action, style)) {
        note('unknown-style', `"${m.style}" is not a style of ${action}`);
        style = defaultStyle(action);
      }
      const keep = [actor, ...(target ? [target] : [])];
      t = ensureOn(actor, keep, t);
      if (target) t = ensureOn(target, keep, t);
      if (lastKey.get(actor) === `${action}/${style}`) {
        const styles = ACTIONS[action].styles as readonly string[];
        style = styles[(styles.indexOf(style) + 1) % styles.length];
      }
      const beat: Omit<ActionBeat, 't'> = { actor, do: action, style };
      if (target && action !== 'cross') beat.target = target;
      const mods = cleanMods(action, m.mods);
      if (mods.length) beat.mods = mods;
      if (m.line) beat.line = m.line;
      const start = t;
      if (action === 'cross') {
        // Walk up to the target (or over to the other half of the stage), then settle back home.
        const home = slotOf.get(actor)!;
        const there = target ? slotOf.get(target)! : undefined;
        const dest = there !== undefined ? there + (home < there ? -0.12 : 0.12) : home === 0.5 ? 0.28 : 1 - home;
        beat.to = round(Math.min(0.92, Math.max(0.08, dest)));
        t = place(beat, t) + GAP;
        t = place({ actor, do: 'plant', style: 'light', to: home }, t) + GAP;
        return;
      }
      t = place(beat, t) + GAP;
      if (action === 'fall') removeFromStage(actor);
      if (action === 'fling' && target) removeFromStage(target);
      const defeated = (action === 'fall' && roles.get(actor)?.role === 'trouble') || (action === 'fling' && target && roles.get(target)?.role === 'trouble');
      if (defeated) beats.push({ t: round(start + (t - start) * 0.5), sfx: 'gong' });
    });
    // Actors who don't appear in the next scene leave the stage.
    const next = sb.scenes[si + 1];
    const needed = new Set(next ? next.moves.flatMap((m) => [actorId(m.who), ...(m.target ? [actorId(m.target)] : [])]) : []);
    let end = t;
    for (const id of [...onStage]) if (!needed.has(id)) end = Math.max(end, exitActor(id, t));
    t = end + GAP;
  });

  // Closing: everyone but the hero leaves, the gunungan is planted, the hero's shadow lingers.
  const hero = [...roles.entries()].find(([, c]) => c.role === 'hero')![0];
  scenes.push({ id: 'tancep-kayon', kind: 'tancep-kayon', title: 'Tancep kayon', start: round(t) });
  beats.push({ t: round(t), music: 'calm' });
  let end = t;
  for (const id of [...onStage]) if (id !== hero) end = Math.max(end, exitActor(id, t));
  t = end + GAP;
  t = ensureOn(hero, [hero], t) + GAP;
  if (slotOf.get(hero) !== 0.22) {
    t = place({ actor: hero, do: 'plant', style: lastKey.get(hero) === 'plant/firm' ? 'light' : 'firm', to: 0.22 }, t) + GAP;
  }
  t = place({ actor: GUNUNGAN, do: 'enter', from: 'right', to: 0.5, style: 'glide' }, t) + GAP;
  t = place({ actor: GUNUNGAN, do: 'gunungan-close', style: pick(['spin', 'sink'] as const) }, t) + GAP;
  beats.push({ t: round(t), sfx: 'gong' });
  const lingerAt = t;
  const lingerEnd = place({ actor: hero, do: 'linger', style: 'fade' }, lingerAt);
  const duration = lingerAt + (lingerEnd - lingerAt) / JITTER_MARGIN;

  const cast: CastMember[] = [
    { id: GUNUNGAN, puppet: 'gunungan', name: 'Gunungan', type: 'gagah' },
    ...sb.cast.map((c) => ({ id: actorId(c.id), puppet: c.puppet, name: c.name, type: c.type })),
  ];
  beats.sort((a, b) => a.t - b.t);
  const lakon: Lakon = { version: 1, title: sb.title, seed, cast, scenes, beats };
  return { lakon, notes, duration: duration + 0.5 };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Keeps only modifiers the checker accepts: combat actions only, no repeats, never high with low. */
function cleanMods(action: Action, mods: string[] | undefined): Modifier[] {
  if (!mods?.length || !(COMBAT_MOD_ACTIONS as readonly string[]).includes(action)) return [];
  const out = [...new Set(mods)].filter((m): m is Modifier => (MODIFIERS as readonly string[]).includes(m));
  return out.includes('high') && out.includes('low') ? out.filter((m) => m !== 'low') : out;
}
