import type { Temperament } from '../script/vocabulary';

export interface TemperamentProfile {
  timeScale: number;
  amplitude: number;
  overshoot: number;
  arm: { stiffness: number; damping: number };
  jitter: number;
}

// Starting values from the spec; tune by feel in this table only.
export const TEMPERAMENTS: Record<Temperament, TemperamentProfile> = {
  halus: { timeScale: 1.3, amplitude: 0.8, overshoot: 0, arm: { stiffness: 120, damping: 20 }, jitter: 0.5 },
  gagah: { timeScale: 1.0, amplitude: 1.0, overshoot: 0.08, arm: { stiffness: 170, damping: 16 }, jitter: 1 },
  raksasa: { timeScale: 1.2, amplitude: 1.25, overshoot: 0.15, arm: { stiffness: 90, damping: 9 }, jitter: 1.2 },
  punakawan: { timeScale: 0.85, amplitude: 1.15, overshoot: 0.12, arm: { stiffness: 220, damping: 8 }, jitter: 1.5 },
};
