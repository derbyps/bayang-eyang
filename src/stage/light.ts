import { hashSeed, mulberry32 } from '../choreo/rng';

export interface Lamp {
  intensity: number;
  dx: number;
  dy: number;
}

const KNOTS = 512;
const cache = new Map<string, Float32Array>();

function knots(seed: number, channel: string): Float32Array {
  const key = `${seed}:${channel}`;
  let k = cache.get(key);
  if (!k) {
    const rand = mulberry32(hashSeed(seed, 'lamp', channel));
    k = Float32Array.from({ length: KNOTS }, () => rand() * 2 - 1);
    cache.set(key, k);
  }
  return k;
}

/** Smooth value noise in [-1, 1] at `hz` knots per second. */
function noise(t: number, hz: number, seed: number, channel: string): number {
  const k = knots(seed, channel);
  const f = t * hz;
  const i = Math.floor(f);
  const u = f - i;
  const s = (1 - Math.cos(Math.PI * u)) / 2;
  const a = k[((i % KNOTS) + KNOTS) % KNOTS];
  const b = k[(((i + 1) % KNOTS) + KNOTS) % KNOTS];
  return a + (b - a) * s;
}

/** The oil lamp's gentle flicker: brightness ±6%, position ±2 px, all under 2 Hz. */
export function lampAt(t: number, seed: number, reduced: boolean): Lamp {
  if (reduced) return { intensity: 1, dx: 0, dy: 0 };
  const flicker = 0.6 * noise(t, 0.7, seed, 'a') + 0.4 * noise(t, 1.6, seed, 'b');
  return {
    intensity: 1 + 0.06 * flicker,
    dx: 2 * noise(t, 0.9, seed, 'x'),
    dy: 1.2 * noise(t, 1.1, seed, 'y'),
  };
}
