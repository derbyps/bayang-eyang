import { describe, expect, test } from 'vitest';
import { lampAt } from '../../src/stage/light';

describe('lampAt', () => {
  const samples = Array.from({ length: 60 * 240 }, (_, i) => lampAt(i / 240, 7, false));

  test('stays within ±6% brightness and ±2 px jitter', () => {
    for (const s of samples) {
      expect(s.intensity).toBeGreaterThanOrEqual(0.94);
      expect(s.intensity).toBeLessThanOrEqual(1.06);
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(s.dy)).toBeLessThanOrEqual(2);
    }
  });

  test('is deterministic for a seed', () => {
    expect(lampAt(12.34, 7, false)).toEqual(lampAt(12.34, 7, false));
  });

  test('changes slowly: no more than 4 mean-crossings per second', () => {
    const mean = samples.reduce((n, s) => n + s.intensity, 0) / samples.length;
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if (Math.sign(samples[i].intensity - mean) !== Math.sign(samples[i - 1].intensity - mean)) crossings++;
    }
    expect(crossings / 60).toBeLessThanOrEqual(4);
  });

  test('is steady under reduced motion', () => {
    expect(lampAt(3, 7, true)).toEqual({ intensity: 1, dx: 0, dy: 0 });
  });
});
