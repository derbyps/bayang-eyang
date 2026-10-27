// Hand-authored motion for every action/style. See spec §5.
//
// Phase pose semantics:
// - tilt, y and the four arm angles are offsets from the rest pose at the end
//   of the phase; a missing key means "back to rest".
// - depth, opacity and flipX are absolute and sticky: a missing key keeps the
//   previous value.
// - tilt > 0 leans forward; arm angles > 0 swing forward; y > 0 is down.
// - x is resolved by the choreographer from XTarget; `rel.dx` is along the
//   facing direction.
import type { Pose } from './pose';
import type { EaseName } from './easing';
import { ACTIONS, isValidStyle, type Action } from '../script/vocabulary';

export type XTarget =
  | { kind: 'target'; gap: number }
  | { kind: 'to' }
  | { kind: 'from-side' }
  | { kind: 'off-side' }
  | { kind: 'rel'; dx: number }
  | { kind: 'abs'; x: number };

export interface Shake {
  tilt?: number;
  y?: number;
  hz: number;
}

export interface Phase {
  dur: number;
  ease: EaseName;
  pose: Partial<Omit<Pose, 'x'>>;
  x?: XTarget;
  shake?: Shake;
}

export interface Template {
  phases: Phase[];
}

type PoseArg = Phase['pose'];
const P = (dur: number, ease: EaseName, pose: PoseArg = {}, x?: XTarget, shake?: Shake): Phase => ({
  dur,
  ease,
  pose,
  ...(x ? { x } : {}),
  ...(shake ? { shake } : {}),
});

const FROM: XTarget = { kind: 'from-side' };
const TO: XTarget = { kind: 'to' };
const OFF: XTarget = { kind: 'off-side' };
const rel = (dx: number): XTarget => ({ kind: 'rel', dx });
const target = (gap: number): XTarget => ({ kind: 'target', gap });
const center: XTarget = { kind: 'abs', x: 0.5 };

const sembah = { shoulderFront: 95, elbowFront: 105, shoulderBack: 85, elbowBack: 105 };
const handToFace = { shoulderFront: 112, elbowFront: 122 };

const T: Record<string, Phase[]> = {
  // Stage
  'enter/glide': [P(0.01, 'snap', {}, FROM), P(1.2, 'out', { tilt: 4 }, TO), P(0.25, 'inOut', { tilt: -2 }), P(0.3, 'inOut')],
  'enter/sneak': [
    P(0.01, 'snap', {}, FROM),
    P(1.3, 'inOut', { tilt: 10, y: 0.01, shoulderFront: -15, shoulderBack: -10 }, TO),
    P(0.3, 'out', { tilt: 3 }),
    P(0.3, 'inOut'),
  ],
  'enter/leap': [
    P(0.01, 'snap', {}, FROM),
    P(0.7, 'out', { y: -0.06, tilt: -6, shoulderFront: 40, shoulderBack: 30 }, TO),
    P(0.3, 'out', { y: 0.01, tilt: 6 }),
    P(0.35, 'inOut'),
  ],
  'exit/glide': [P(0.2, 'out', { tilt: -3 }), P(1.2, 'inOut', { tilt: 4 }, OFF), P(0.1, 'linear', { tilt: 4 }), P(0.1, 'linear')],
  'exit/flee': [
    P(0.15, 'out', { tilt: -8, shoulderFront: 60, shoulderBack: 50 }),
    P(0.9, 'inOut', { tilt: 14, shoulderFront: -30, shoulderBack: 70 }, OFF),
    P(0.1, 'linear', { tilt: 14 }),
    P(0.1, 'linear'),
  ],
  'exit/leap': [
    P(0.25, 'out', { y: 0.015, tilt: 4 }),
    P(0.8, 'out', { y: -0.08, tilt: -8, shoulderFront: 50 }, OFF),
    P(0.1, 'linear', { y: -0.08 }),
    P(0.1, 'linear'),
  ],
  'plant/firm': [P(0.3, 'out', { y: -0.02 }), P(0.25, 'snap', { y: 0.008 }, TO), P(0.3, 'out', { y: -0.004 }), P(0.4, 'inOut')],
  'plant/light': [P(0.4, 'inOut', { y: -0.012, tilt: -2 }), P(0.5, 'inOut', {}, TO), P(0.3, 'inOut', { tilt: 1 }), P(0.3, 'inOut')],
  'cross/walk': [P(0.2, 'out', { tilt: 2 }), P(1.2, 'inOut', { tilt: 3 }, TO), P(0.25, 'out', { tilt: -1 }), P(0.25, 'inOut')],
  'cross/hurry': [
    P(0.15, 'out', { tilt: 8 }),
    P(0.8, 'inOut', { tilt: 10, shoulderFront: 30, shoulderBack: -20 }, TO),
    P(0.2, 'out', { tilt: -4 }),
    P(0.25, 'inOut'),
  ],

  // Gesture
  'speak/calm': [
    P(0.15, 'out', { shoulderFront: 25, elbowFront: 15 }),
    P(0.5, 'inOut', { shoulderFront: 35, elbowFront: 20 }),
    P(0.3, 'inOut', { shoulderFront: 20 }),
    P(0.3, 'inOut'),
  ],
  'speak/animated': [
    P(0.12, 'out', { shoulderFront: 50, elbowFront: 40 }),
    P(0.35, 'inOut', { shoulderFront: 20, elbowFront: -10, tilt: 3 }),
    P(0.3, 'out', { shoulderFront: 60, elbowFront: 30, tilt: -2 }),
    P(0.35, 'inOut'),
  ],
  'bow/sembah': [
    P(0.3, 'out', { shoulderFront: 40, shoulderBack: 30 }),
    P(0.5, 'inOut', { ...sembah, tilt: 8 }),
    P(0.4, 'inOut', { ...sembah, tilt: 10 }),
    P(0.4, 'inOut'),
  ],
  'bow/deep': [
    P(0.2, 'out', { tilt: -3 }),
    P(0.5, 'inOut', { tilt: 28, y: 0.01, shoulderFront: -10, shoulderBack: -5 }),
    P(0.35, 'linear', { tilt: 30, y: 0.01, shoulderFront: -10, shoulderBack: -5 }),
    P(0.4, 'inOut'),
  ],
  'point/accuse': [
    P(0.2, 'out', { shoulderFront: -10, tilt: -3 }),
    P(0.25, 'out', { shoulderFront: 80, elbowFront: -20, tilt: 6 }),
    P(0.5, 'linear', { shoulderFront: 78, elbowFront: -18, tilt: 5 }, undefined, { tilt: 1, hz: 5 }),
    P(0.35, 'inOut'),
  ],
  'point/guide': [
    P(0.3, 'inOut', { shoulderFront: 30 }),
    P(0.45, 'inOut', { shoulderFront: 60, elbowFront: 10 }),
    P(0.4, 'inOut', { shoulderFront: 55, elbowFront: 5, tilt: 2 }),
    P(0.35, 'inOut'),
  ],
  'look-far/shade': [
    P(0.25, 'out', { tilt: -3 }),
    P(0.4, 'inOut', { shoulderFront: 130, elbowFront: 120, tilt: -6 }),
    P(0.5, 'linear', { shoulderFront: 130, elbowFront: 120, tilt: -8 }),
    P(0.35, 'inOut'),
  ],
  'look-far/peer': [
    P(0.2, 'out'),
    P(0.35, 'inOut', { tilt: 12, y: -0.01, shoulderBack: -20 }),
    P(0.5, 'linear', { tilt: 14, y: -0.012, shoulderBack: -20 }),
    P(0.35, 'inOut'),
  ],
  'laugh/giggle': [
    P(0.1, 'out', { shoulderFront: 60, elbowFront: 110 }),
    P(0.5, 'linear', { shoulderFront: 60, elbowFront: 110, tilt: -4 }, undefined, { tilt: 2, hz: 8 }),
    P(0.2, 'out', { tilt: -2 }),
    P(0.3, 'inOut'),
  ],
  'laugh/belly': [
    P(0.15, 'out', { tilt: -8, shoulderFront: -20, shoulderBack: -25 }),
    P(0.6, 'linear', { tilt: -10, shoulderFront: -20, shoulderBack: -25 }, undefined, { tilt: 2, y: 0.006, hz: 5 }),
    P(0.25, 'out', { tilt: 4 }),
    P(0.3, 'inOut'),
  ],
  'weep/quiet': [
    P(0.3, 'inOut', { tilt: 10 }),
    P(0.5, 'inOut', { ...handToFace, tilt: 14 }),
    P(0.4, 'linear', { ...handToFace, tilt: 14 }, undefined, { tilt: 1, hz: 2.5 }),
    P(0.4, 'inOut'),
  ],
  'weep/sob': [
    P(0.2, 'out', { tilt: 8 }),
    P(0.3, 'inOut', { ...handToFace, shoulderBack: 100, elbowBack: 120, tilt: 16, y: 0.006 }),
    P(0.6, 'linear', { ...handToFace, shoulderBack: 100, elbowBack: 120, tilt: 16, y: 0.006 }, undefined, { y: 0.005, hz: 3.5 }),
    P(0.4, 'inOut'),
  ],
  'dance/kiprah': [
    P(0.25, 'out', { shoulderFront: 70, elbowFront: -10, shoulderBack: -30, tilt: -5 }),
    P(0.4, 'inOut', { shoulderFront: -20, shoulderBack: 80, elbowBack: -10, tilt: 6, y: -0.01 }, rel(0.03)),
    P(0.4, 'inOut', { shoulderFront: 80, shoulderBack: -20, tilt: -6 }, rel(-0.03)),
    P(0.4, 'inOut'),
  ],
  'dance/sway': [
    P(0.35, 'inOut', { tilt: 6, shoulderFront: 40, shoulderBack: 30 }),
    P(0.4, 'inOut', { tilt: -6, shoulderFront: 20, shoulderBack: 50 }),
    P(0.4, 'inOut', { tilt: 5, shoulderFront: 45, shoulderBack: 25 }),
    P(0.4, 'inOut'),
  ],

  // Combat
  'attack/thrust': [
    P(0.25, 'out', { shoulderFront: -25, elbowFront: 60, tilt: -6 }),
    P(0.18, 'out', { shoulderFront: 85, elbowFront: -5, tilt: 10 }, target(0.12)),
    P(0.2, 'out', { shoulderFront: 70, elbowFront: 10, tilt: 6 }),
    P(0.3, 'inOut', {}, rel(-0.04)),
  ],
  'attack/sweep': [
    P(0.25, 'out', { shoulderFront: -60, elbowFront: 20, tilt: -8 }),
    P(0.22, 'out', { shoulderFront: 120, elbowFront: 10, tilt: 8 }, target(0.14)),
    P(0.2, 'out', { shoulderFront: 100, tilt: 4 }),
    P(0.3, 'inOut', {}, rel(-0.04)),
  ],
  'attack/slam': [
    P(0.3, 'out', { shoulderFront: 160, elbowFront: 20, shoulderBack: 140, tilt: -10, y: -0.015 }),
    P(0.15, 'out', { shoulderFront: 40, elbowFront: 10, shoulderBack: 30, tilt: 16, y: 0.008 }, target(0.1)),
    P(0.25, 'out', { tilt: 10 }),
    P(0.3, 'inOut', {}, rel(-0.05)),
  ],
  'attack/kick': [
    P(0.25, 'out', { tilt: -12, y: -0.01 }),
    P(0.18, 'out', { tilt: -25, y: -0.02, shoulderFront: 40, shoulderBack: 60 }, target(0.12)),
    P(0.22, 'out', { tilt: 8 }),
    P(0.3, 'inOut', {}, rel(-0.05)),
  ],
  'attack/grab': [
    P(0.25, 'out', { shoulderFront: -20, shoulderBack: -20, tilt: -4 }),
    P(0.2, 'out', { shoulderFront: 90, elbowFront: 30, shoulderBack: 85, elbowBack: 30, tilt: 10 }, target(0.07)),
    P(0.3, 'linear', { shoulderFront: 90, elbowFront: 30, shoulderBack: 85, elbowBack: 30, tilt: 10 }, undefined, { tilt: 2, hz: 7 }),
    P(0.3, 'inOut', {}, rel(-0.04)),
  ],
  'attack/charge': [
    P(0.2, 'out', { tilt: -6, y: 0.006 }),
    P(0.4, 'inOut', { tilt: 20, shoulderFront: 60, elbowFront: -10, shoulderBack: -30 }, target(0.06)),
    P(0.2, 'out', { tilt: 6 }),
    P(0.3, 'inOut', {}, rel(-0.08)),
  ],
  'strike/jab': [
    P(0.15, 'out', { shoulderFront: 10, elbowFront: 70 }),
    P(0.12, 'out', { shoulderFront: 80, elbowFront: -5, tilt: 5 }),
    P(0.15, 'out', { shoulderFront: 60, elbowFront: 20 }),
    P(0.25, 'inOut'),
  ],
  'strike/chop': [
    P(0.2, 'out', { shoulderFront: 150, elbowFront: 30, tilt: -5 }),
    P(0.14, 'out', { shoulderFront: 60, elbowFront: 0, tilt: 8 }),
    P(0.2, 'out', { shoulderFront: 50, tilt: 4 }),
    P(0.3, 'inOut'),
  ],
  'dodge/hop': [P(0.12, 'out', { y: 0.006 }), P(0.28, 'out', { y: -0.04, tilt: -10 }, rel(-0.08)), P(0.2, 'out', { y: 0.004, tilt: 3 }), P(0.25, 'inOut')],
  'dodge/duck': [
    P(0.12, 'out'),
    P(0.2, 'out', { y: 0.05, tilt: 18, shoulderFront: -20, shoulderBack: -20 }),
    P(0.25, 'linear', { y: 0.05, tilt: 18, shoulderFront: -20, shoulderBack: -20 }),
    P(0.3, 'inOut'),
  ],
  'dodge/spin': [P(0.12, 'out'), P(0.25, 'inOut', { flipX: -1 }, rel(-0.06)), P(0.25, 'inOut', { flipX: 1 }), P(0.2, 'inOut')],
  'fling/spin': [
    P(0.2, 'out', { shoulderFront: -30, shoulderBack: -30, tilt: -6 }),
    P(0.25, 'out', { shoulderFront: 140, elbowFront: 10, shoulderBack: 120, tilt: 12 }),
    P(0.25, 'out', { shoulderFront: 110, tilt: 6 }),
    P(0.3, 'inOut'),
  ],
  'fling/arc': [
    P(0.25, 'out', { shoulderFront: -40, elbowFront: 40, tilt: -10, y: 0.01 }),
    P(0.2, 'out', { shoulderFront: 170, elbowFront: 0, tilt: -4, y: -0.01 }),
    P(0.25, 'out', { shoulderFront: 150 }),
    P(0.3, 'inOut'),
  ],
  'fall/crumple': [
    P(0.15, 'out', { tilt: -8 }),
    P(0.35, 'inOut', { tilt: 45, y: 0.04 }),
    P(0.3, 'out', { tilt: 80, y: 0.25, opacity: 0.6 }),
    P(0.2, 'linear', { tilt: 85, y: 0.4, opacity: 0 }),
  ],
  'fall/flung-off': [
    P(0.1, 'out', { tilt: -10 }),
    P(0.3, 'out', { tilt: -60, y: -0.08 }, rel(-0.25)),
    P(0.3, 'linear', { tilt: -200, y: 0.1, opacity: 0.5 }, rel(-0.25)),
    P(0.2, 'linear', { tilt: -260, y: 0.4, opacity: 0 }, rel(-0.1)),
  ],
  'fall/sink': [
    P(0.15, 'out', { y: -0.01 }),
    P(0.35, 'inOut', { y: 0.12, tilt: 6 }),
    P(0.3, 'inOut', { y: 0.35, tilt: 8, opacity: 0.7 }),
    P(0.2, 'linear', { y: 0.5, tilt: 8, opacity: 0 }),
  ],

  // Light
  'loom/rise': [
    P(0.3, 'out', { tilt: -3 }),
    P(0.9, 'inOut', { depth: 0.5, shoulderFront: 50, shoulderBack: 40, tilt: -5 }),
    P(0.3, 'out', { shoulderFront: 60 }),
    P(0.3, 'inOut'),
  ],
  'loom/rush': [
    P(0.15, 'out', { tilt: -4 }),
    P(0.35, 'out', { depth: 0.55, tilt: 10, shoulderFront: 90, elbowFront: -10 }),
    P(0.25, 'out', { depth: 0.5, tilt: 4 }),
    P(0.35, 'inOut'),
  ],
  'recede/drift': [P(0.2, 'inOut'), P(1.0, 'inOut', { depth: 0 }), P(0.2, 'inOut'), P(0.2, 'inOut')],
  'recede/snap': [P(0.1, 'out'), P(0.25, 'out', { depth: 0, tilt: -6 }), P(0.4, 'out', { tilt: 3 }), P(0.3, 'inOut')],

  // Gunungan
  'gunungan-open/spin': [
    P(0.5, 'inOut', { flipX: -1, y: -0.02 }, center),
    P(0.5, 'inOut', { flipX: 1, y: -0.03 }),
    P(0.5, 'inOut', { flipX: -1, y: -0.02 }),
    P(0.8, 'out', { flipX: 1 }),
  ],
  'gunungan-open/rise': [
    P(0.05, 'snap', { y: 0.5 }, center),
    P(1.2, 'out', { y: -0.02, tilt: -3 }),
    P(0.5, 'inOut', { tilt: 3 }),
    P(0.6, 'inOut'),
  ],
  'gunungan-close/spin': [
    P(0.4, 'inOut', { flipX: -1 }, center),
    P(0.5, 'inOut', { flipX: 1, tilt: -4 }),
    P(0.5, 'inOut', { flipX: -1, tilt: 4 }),
    P(0.7, 'out', { flipX: 1 }),
  ],
  'gunungan-close/sink': [P(0.4, 'inOut', { tilt: -3 }, center), P(0.6, 'inOut', { tilt: 3 }), P(0.8, 'inOut', { y: 0.06 }), P(0.5, 'out', { y: 0.05 })],
  'gunungan-storm/wind': [
    P(0.3, 'out', { tilt: -6 }),
    P(0.8, 'linear', { tilt: -4 }, undefined, { tilt: 4, hz: 6 }),
    P(0.8, 'linear', { tilt: 4 }, undefined, { tilt: 4, hz: 6 }),
    P(0.4, 'inOut'),
  ],
  'gunungan-storm/fire': [
    P(0.2, 'out', { y: -0.02 }),
    P(0.9, 'linear', { y: -0.03, tilt: 2 }, undefined, { tilt: 6, y: 0.004, hz: 9 }),
    P(0.7, 'linear', { y: -0.02, tilt: -2 }, undefined, { tilt: 5, hz: 8 }),
    P(0.4, 'inOut'),
  ],

  // Ending: hold, then drift toward the lamp and dissolve.
  'linger/fade': [
    P(1.2, 'linear'),
    P(0.5, 'inOut', { depth: 0.15, opacity: 0.8 }),
    P(0.6, 'out', { depth: 0.3, opacity: 0.3 }),
    P(0.4, 'out', { depth: 0.33, opacity: 0 }),
  ],
};

/** Recoil applied to an actor who is hit. */
export const TARGET_REACTION: Template = {
  phases: [
    P(0.05, 'linear'),
    P(0.12, 'out', { tilt: -14, shoulderFront: -20, shoulderBack: -25 }, rel(-0.03)),
    P(0.25, 'out', { tilt: 4 }),
    P(0.3, 'inOut'),
  ],
};

export function getTemplate(action: Action, style: string): Template {
  if (!isValidStyle(action, style)) {
    throw new Error(`no template for ${action}/${style}; styles are ${ACTIONS[action].styles.join(', ')}`);
  }
  return { phases: T[`${action}/${style}`] };
}
