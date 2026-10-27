export const MAX_DEPTH = 0.6;

/** How a puppet's shadow looks at a given distance from the screen toward the lamp. */
export function depthToShadow(depth: number): { scale: number; blur: number; opacity: number } {
  const d = Math.min(MAX_DEPTH, Math.max(0, depth));
  return { scale: 1 / (1 - d), blur: d * 24, opacity: 1 - d * 0.6 };
}
