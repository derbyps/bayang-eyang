/** A puppet's full pose. Angles are degrees; x, y are stage units; depth 0 sits on the screen. */
export interface Pose {
  x: number;
  y: number;
  tilt: number;
  depth: number;
  shoulderBack: number;
  elbowBack: number;
  shoulderFront: number;
  elbowFront: number;
  flipX: number;
  opacity: number;
}

export const POSE_KEYS = [
  'x',
  'y',
  'tilt',
  'depth',
  'shoulderBack',
  'elbowBack',
  'shoulderFront',
  'elbowFront',
  'flipX',
  'opacity',
] as const satisfies readonly (keyof Pose)[];

export const FEET_Y = 0.86;

export const REST_POSE: Pose = {
  x: 0.5,
  y: FEET_Y,
  tilt: 0,
  depth: 0,
  shoulderBack: 15,
  elbowBack: 20,
  shoulderFront: 20,
  elbowFront: 25,
  flipX: 1,
  opacity: 1,
};

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}
