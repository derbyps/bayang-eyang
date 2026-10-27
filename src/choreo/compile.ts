// Turns a validated lakon into a deterministic, pre-baked timeline.
import { getRig } from '../rigs';
import { isActionBeat, type ActionBeat, type CastMember, type Lakon } from '../script/schema';
import { ACTIONS, defaultStyle, type PuppetKey, type Temperament } from '../script/vocabulary';
import { EASE, type EaseName } from './easing';
import { POSE_KEYS, REST_POSE, type Pose } from './pose';
import { hashSeed, mulberry32 } from './rng';
import { TEMPERAMENTS } from './temperament';
import { getTemplate, TARGET_REACTION, type Phase, type Shake, type XTarget } from './templates';
import { applyModifiers } from './modifiers';
import type { Modifier } from '../script/vocabulary';
import { sortCues, speakDuration, trimCaptions, type CaptionSpan, type Cue } from './cues';

export { speakDuration } from './cues';
export type { CaptionSpan, Cue } from './cues';

export const SAMPLE_RATE = 120;
const STRIDE = POSE_KEYS.length;
const ANGLE_KEYS = ['tilt', 'shoulderBack', 'elbowBack', 'shoulderFront', 'elbowFront'] as const;
const OFFSET_KEYS = ['y', ...ANGLE_KEYS] as const;
const STICKY_KEYS = ['depth', 'opacity'] as const;
const SPEED = { slow: 1.3, normal: 1, fast: 0.75 } as const;
const OFFSTAGE_LEFT = -0.2;
const OFFSTAGE_RIGHT = 1.2;
const TURN_TIME = 0.15;
const TAIL = 0.5;

export interface ActorTrack {
  rig: PuppetKey;
  type: Temperament;
  samples: Float32Array;
  onStage: [number, number][];
}

export interface BeatSpan {
  beat: number;
  actor: string;
  start: number;
  end: number;
}

export interface Timeline {
  title: string;
  duration: number;
  seed: number;
  cast: CastMember[];
  scenes: Lakon['scenes'];
  actors: Record<string, ActorTrack>;
  cues: Cue[];
  captions: CaptionSpan[];
  beats: Lakon['beats'];
  spans: BeatSpan[];
}

export interface CompileOptions {
  reducedMotion?: boolean;
}

interface Keyframe {
  t: number;
  pose: Pose;
  ease: EaseName;
  shake?: Shake;
}

interface ActorState {
  member: CastMember;
  keys: Keyframe[];
  facing: number;
  templateFlip: number;
  moves: number;
  combats: number;
  enteredAt: number | null;
  onStage: [number, number][];
  speaking: [number, number][];
  /** Hits received: time of impact and the direction to be pushed (+1 = right). */
  hits: { t: number; dir: number }[];
  /** Impacts this actor has scheduled; dropped if the move is cut before they land. */
  pending: { t: number; land: () => void }[];
}

/** Lands the actor's pending impacts that happen by `until`; drops the rest (their move was cut). */
function settle(st: ActorState, until: number) {
  const due = st.pending.filter((p) => p.t <= until);
  st.pending = [];
  for (const p of due) p.land();
}

function evalKeys(keys: Keyframe[], t: number): Pose {
  if (keys.length === 0) return { ...REST_POSE };
  if (t <= keys[0].t) return { ...keys[0].pose };
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.t) {
      const a = keys[i - 1];
      const k = b.t === a.t ? 1 : EASE[b.ease]((t - a.t) / (b.t - a.t));
      const out = { ...a.pose };
      for (const key of POSE_KEYS) out[key] = a.pose[key] + (b.pose[key] - a.pose[key]) * k;
      return out;
    }
  }
  return { ...keys[keys.length - 1].pose };
}

/** Cuts the keyframe list at t so a new beat can start from the current pose. */
function cutAt(keys: Keyframe[], t: number): Pose {
  const pose = evalKeys(keys, t);
  let i = keys.length;
  while (i > 0 && keys[i - 1].t > t) i--;
  const next = keys[i];
  keys.length = i;
  if (keys.length === 0 || keys[keys.length - 1].t < t) keys.push({ t, pose, ease: next?.ease ?? 'linear' });
  return pose;
}

export function compile(lakon: Lakon, opts: CompileOptions = {}): Timeline {
  const reduced = opts.reducedMotion ?? false;
  const states = new Map<string, ActorState>();
  for (const member of lakon.cast) {
    states.set(member.id, {
      member,
      keys: [],
      facing: 1,
      templateFlip: 1,
      moves: 0,
      combats: 0,
      enteredAt: null,
      onStage: [],
      speaking: [],
      hits: [],
      pending: [],
    });
  }

  const spans: BeatSpan[] = [];
  const captions: CaptionSpan[] = [];
  const cues: Cue[] = [];
  let end = 0;

  lakon.beats.forEach((beat, index) => {
    end = Math.max(end, beat.t);
    if ('narrate' in beat) {
      captions.push({ start: beat.t, end: beat.t + speakDuration(beat.narrate), speaker: null, text: beat.narrate });
      return;
    }
    if ('sfx' in beat) {
      cues.push({ t: beat.t, kind: 'sfx', id: beat.sfx });
      return;
    }
    if ('music' in beat) {
      cues.push({ t: beat.t, kind: 'music', pattern: beat.music });
      return;
    }
    if (!isActionBeat(beat)) return;
    settle(states.get(beat.actor)!, beat.t);
    const span = performBeat(beat, index);
    spans.push(span);
    end = Math.max(end, span.end);
    if (beat.do === 'speak' && beat.line) {
      const st = states.get(beat.actor)!;
      captions.push({ start: beat.t, end: beat.t + speakDuration(beat.line), speaker: st.member.name, text: beat.line });
      st.speaking.push([beat.t, beat.t + speakDuration(beat.line)]);
    }
  });

  function xOf(id: string, t: number): number {
    return evalKeys(states.get(id)!.keys, t).x;
  }

  /** The flung actor tumbles away from the thrower and leaves the stage. */
  function flingOff(target: ActorState, t: number, throwerX: number, style: string) {
    const tx = xOf(target.member.id, t);
    const synthetic: ActionBeat = { t, actor: target.member.id, do: 'fall', style: 'flung-off' };
    target.facing = Math.sign(throwerX - tx) || target.facing;
    const span = performBeat(synthetic, -1, style === 'spin');
    end = Math.max(end, span.end);
  }

  function performBeat(beat: ActionBeat, index: number, spinning = false): BeatSpan {
    const st = states.get(beat.actor)!;
    const profile = TEMPERAMENTS[st.member.type];
    const style = beat.style ?? defaultStyle(beat.do);
    const rand = mulberry32(hashSeed(lakon.seed, beat.actor, st.moves++));
    const mods = (beat.mods ?? []) as Modifier[];
    const phases: Phase[] = applyModifiers(getTemplate(beat.do, style), mods, rand).phases;
    if (spinning) phases.forEach((p, i) => (p.pose.flipX = i % 2 === 0 ? -1 : 1));
    if (beat.do === 'enter') cues.push({ t: beat.t, kind: 'sfx', id: 'cempala-1' });
    const isCombat = ACTIONS[beat.do].group === 'combat';
    const baseIntensity = beat.intensity ?? 0.6;
    const intensity = isCombat ? Math.min(1, baseIntensity * (1 + 0.15 * st.combats++)) : baseIntensity;
    const gain = profile.amplitude * (0.4 + intensity) * (reduced && isCombat ? 0.5 : 1);
    const speed = SPEED[beat.speed ?? 'normal'];

    let t = beat.t;
    let from: Pose;
    if (beat.do === 'enter') {
      const side = beat.from ?? 'left';
      st.facing = side === 'left' ? 1 : -1;
      st.templateFlip = 1;
      from = { ...REST_POSE, x: side === 'left' ? OFFSTAGE_LEFT : OFFSTAGE_RIGHT, flipX: st.facing };
      // Keep earlier appearances: cut the history here and step to the wings.
      if (st.keys.length) cutAt(st.keys, t);
      st.keys.push({ t, pose: from, ease: 'linear' });
      st.enteredAt = t;
    } else {
      from = cutAt(st.keys, t);
    }

    // Decide which way to face for this beat.
    const turnTo = (dir: number) => {
      if (dir !== 0 && Math.sign(dir) !== st.facing) {
        st.facing = Math.sign(dir);
        const turned = { ...from, flipX: st.facing * st.templateFlip };
        st.keys.push({ t: t + TURN_TIME, pose: turned, ease: 'inOut' });
        from = turned;
        t += TURN_TIME;
      }
    };
    if (beat.target) turnTo(xOf(beat.target, beat.t) - from.x);
    else if (beat.do === 'cross' && beat.to !== undefined) turnTo(beat.to - from.x);
    else if (beat.do === 'exit') turnTo(from.x < 0.5 ? -1 : 1);

    const resolveX = (x: XTarget, current: number): number => {
      switch (x.kind) {
        case 'from-side':
          return (beat.from ?? 'left') === 'left' ? OFFSTAGE_LEFT : OFFSTAGE_RIGHT;
        case 'to':
          if (beat.to !== undefined) return beat.to;
          if (beat.do === 'enter') return (beat.from ?? 'left') === 'left' ? 0.28 : 0.72;
          return current;
        case 'off-side':
          return current < 0.5 ? OFFSTAGE_LEFT : OFFSTAGE_RIGHT;
        case 'rel':
          return current + st.facing * x.dx;
        case 'abs':
          return x.x;
        case 'target': {
          const tx = beat.target ? xOf(beat.target, beat.t) : current;
          return tx - st.facing * x.gap;
        }
      }
    };

    const impacts: number[] = [];
    let x = from.x;
    let sticky = { depth: from.depth, opacity: from.opacity };
    phases.forEach((phase, i) => {
      const last = i === phases.length - 1;
      const jitterT = 1 + profile.jitter * 0.08 * (2 * rand() - 1);
      const dur = phase.dur * profile.timeScale * speed * jitterT;
      t += dur;
      if (phase.x) x = resolveX(phase.x, x);
      if (phase.pose.flipX !== undefined) st.templateFlip = phase.pose.flipX;
      for (const key of STICKY_KEYS) if (phase.pose[key] !== undefined) sticky = { ...sticky, [key]: phase.pose[key] };
      const overshoot = phase.role === 'action' ? 1 + profile.overshoot : 1;
      const pose: Pose = { ...REST_POSE, x, ...sticky, flipX: st.facing * st.templateFlip };
      for (const key of OFFSET_KEYS) {
        const offset = phase.pose[key];
        if (offset === undefined) continue;
        const noise = !last && key !== 'y' ? profile.jitter * 5 * (2 * rand() - 1) : 0;
        pose[key] = REST_POSE[key] + offset * gain * overshoot + noise;
      }
      st.keys.push({ t, pose, ease: phase.ease, shake: phase.shake });
      if (phase.role === 'action' && beat.target) impacts.push(t);
    });

    const target = beat.target ? states.get(beat.target) : undefined;
    const landsHit = beat.do === 'strike' || (beat.do === 'attack' && !mods.includes('miss'));
    for (const hitT of impacts) {
      if (!target || !landsHit) break;
      const attackerX = x;
      st.pending.push({
        t: hitT,
        land: () => {
          const pushDir = Math.sign(xOf(target.member.id, hitT) - attackerX) || st.facing;
          target.hits.push({ t: hitT, dir: pushDir });
          cues.push({ t: hitT, kind: 'sfx', id: 'keprak' });
        },
      });
    }
    if (beat.do === 'fling' && target && impacts.length > 0) {
      const hitT = impacts[0];
      const throwerX = x;
      st.pending.push({
        t: hitT,
        land: () => {
          cues.push({ t: hitT, kind: 'sfx', id: 'cempala-roll' });
          flingOff(target, hitT, throwerX, style);
        },
      });
    }

    if (beat.do === 'exit' || beat.do === 'fall' || beat.do === 'linger') {
      if (st.enteredAt !== null) st.onStage.push([st.enteredAt, t]);
      st.enteredAt = null;
    }
    return { beat: index, actor: beat.actor, start: beat.t, end: t };
  }

  for (const st of states.values()) settle(st, Infinity);
  const captionsOut = trimCaptions(captions);
  for (const c of captionsOut) end = Math.max(end, c.end);
  const duration = end + TAIL;

  const actors: Record<string, ActorTrack> = {};
  for (const [id, st] of states) {
    if (st.enteredAt !== null) st.onStage.push([st.enteredAt, duration]);
    actors[id] = {
      rig: st.member.puppet as PuppetKey,
      type: st.member.type,
      samples: bake(st, duration, lakon.seed, reduced),
      onStage: st.onStage,
    };
  }

  return {
    title: lakon.title,
    duration,
    seed: lakon.seed,
    cast: lakon.cast,
    scenes: lakon.scenes,
    actors,
    cues: sortCues(cues),
    captions: captionsOut,
    beats: lakon.beats,
    spans,
  };
}

// Offsets (from rest) traced by a recoil, as keyframes from the moment of impact.
const RECOIL: { t: number; ease: EaseName; off: Partial<Record<'x' | 'tilt' | 'shoulderFront' | 'shoulderBack', number>> }[] = (() => {
  let t = 0;
  return [
    { t: 0, ease: 'linear' as EaseName, off: {} },
    ...TARGET_REACTION.phases.map((p) => {
      t += p.dur;
      const off: Record<string, number> = {};
      for (const key of ['tilt', 'shoulderFront', 'shoulderBack'] as const) if (p.pose[key] !== undefined) off[key] = p.pose[key]!;
      if (p.x?.kind === 'rel') off.x = p.x.dx;
      return { t, ease: p.ease, off };
    }),
  ];
})();
const RECOIL_KEYS = ['x', 'tilt', 'shoulderFront', 'shoulderBack'] as const;
const RECOIL_END = RECOIL[RECOIL.length - 1].t;

function recoilAt(dt: number, key: (typeof RECOIL_KEYS)[number]): number {
  if (dt <= 0 || dt >= RECOIL_END) return 0;
  for (let i = 1; i < RECOIL.length; i++) {
    const b = RECOIL[i];
    if (dt <= b.t) {
      const a = RECOIL[i - 1];
      const k = EASE[b.ease]((dt - a.t) / (b.t - a.t));
      const va = a.off[key] ?? 0, vb = b.off[key] ?? 0;
      return va + (vb - va) * k;
    }
  }
  return 0;
}

const ARM_KEYS = ['shoulderBack', 'elbowBack', 'shoulderFront', 'elbowFront'] as const;

function bake(st: ActorState, duration: number, seed: number, reduced: boolean): Float32Array {
  const n = Math.ceil(duration * SAMPLE_RATE) + 1;
  const out = new Float32Array(n * STRIDE);
  const rand = mulberry32(hashSeed(seed, st.member.id, 'idle'));
  const swayAmp = 0.4 + rand() * 0.4;
  const swayPhase = rand() * Math.PI * 2;
  const isGunungan = getRig(st.member.puppet as PuppetKey).arms === null;
  const spring = TEMPERAMENTS[st.member.type].arm;
  const armPos = [0, 0, 0, 0];
  const armVel = [0, 0, 0, 0];
  let k = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const pose = evalKeys(st.keys, t);
    while (k < st.keys.length - 1 && st.keys[k].t < t) k++;
    const seg = st.keys[k];
    const prev = st.keys[k - 1];
    if (!reduced && seg?.shake && prev && t > prev.t && t <= seg.t) {
      const p = (t - prev.t) / (seg.t - prev.t);
      const env = Math.sin(Math.PI * p);
      const wave = Math.sin(2 * Math.PI * seg.shake.hz * (t - prev.t));
      pose.tilt += (seg.shake.tilt ?? 0) * wave * env;
      pose.y += (seg.shake.y ?? 0) * wave * env;
    }
    for (const hit of st.hits) {
      const dt = t - hit.t;
      if (dt <= 0 || dt >= RECOIL_END) continue;
      pose.x -= recoilAt(dt, 'x') * hit.dir;
      pose.tilt += recoilAt(dt, 'tilt');
      pose.shoulderFront += recoilAt(dt, 'shoulderFront');
      pose.shoulderBack += recoilAt(dt, 'shoulderBack');
    }
    if (!reduced) {
      pose.tilt += swayAmp * Math.sin(2 * Math.PI * 0.3 * t + swayPhase) * (isGunungan ? 0.5 : 1);
      for (const [a, b] of st.speaking) {
        if (t >= a && t <= b) pose.y += 0.0037 * Math.sin(2 * Math.PI * 4 * (t - a)) * Math.sin((Math.PI * (t - a)) / (b - a));
      }
    }
    springArms(pose, t, i === 0);
    for (let j = 0; j < STRIDE; j++) out[i * STRIDE + j] = pose[POSE_KEYS[j]];
  }
  return out;

  // Arms trail the rods on a damped spring: the secondary motion that makes a puppet feel held.
  function springArms(pose: Pose, t: number, first: boolean) {
    const live = st.onStage.some(([a, b]) => t >= a && t <= b);
    for (let j = 0; j < ARM_KEYS.length; j++) {
      const key = ARM_KEYS[j];
      const target = pose[key];
      if (first || !live) {
        armPos[j] = target;
        armVel[j] = 0;
        continue;
      }
      const dt = 1 / SAMPLE_RATE;
      armVel[j] += (spring.stiffness * (target - armPos[j]) - spring.damping * armVel[j]) * dt;
      armPos[j] += armVel[j] * dt;
      pose[key] = armPos[j];
    }
  }
}

export function samplePose(tl: Timeline, id: string, t: number): Pose | null {
  const track = tl.actors[id];
  if (!track || !track.onStage.some(([a, b]) => t >= a && t <= b)) return null;
  const n = track.samples.length / STRIDE;
  const f = Math.min(n - 1, Math.max(0, t * SAMPLE_RATE));
  const i0 = Math.floor(f);
  const i1 = Math.min(n - 1, i0 + 1);
  const k = f - i0;
  const pose = { ...REST_POSE };
  for (let j = 0; j < STRIDE; j++) {
    const a = track.samples[i0 * STRIDE + j];
    pose[POSE_KEYS[j]] = a + (track.samples[i1 * STRIDE + j] - a) * k;
  }
  return pose;
}
