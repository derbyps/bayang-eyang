import { describe, expect, test } from 'vitest';
import { hashSeed, mulberry32 } from '../../src/choreo/rng';
import { EASE } from '../../src/choreo/easing';
import { TEMPERAMENTS } from '../../src/choreo/temperament';
import { REST_POSE, lerpPose } from '../../src/choreo/pose';

describe('rng', () => {
  test('same seed gives the same sequence', () => {
    const a = mulberry32(hashSeed(7, 'petruk', 2));
    const b = mulberry32(hashSeed(7, 'petruk', 2));
    const seqA = Array.from({ length: 5 }, a);
    const seqB = Array.from({ length: 5 }, b);
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });

  test('different parts give different seeds', () => {
    expect(hashSeed(7, 'petruk', 2)).not.toBe(hashSeed(7, 'petruk', 3));
  });
});

describe('easing', () => {
  test('out hits endpoints and front-loads motion', () => {
    expect(EASE.out(0)).toBe(0);
    expect(EASE.out(1)).toBe(1);
    expect(EASE.out(0.5)).toBeGreaterThan(0.5);
  });

  test('inOut is an S-curve: slow start, fast middle, slow end', () => {
    expect(EASE.inOut(0.25)).toBeLessThan(0.1);
    expect(EASE.inOut(0.5)).toBeCloseTo(0.596, 2);
    expect(EASE.inOut(0.75)).toBeGreaterThan(0.9);
  });

  test('curves are monotonic', () => {
    for (const ease of [EASE.out, EASE.inOut]) {
      let prev = -1;
      for (let i = 0; i <= 100; i++) {
        const v = ease(i / 100);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
});

describe('temperament', () => {
  test('values match the spec', () => {
    expect(TEMPERAMENTS.raksasa.arm).toEqual({ stiffness: 90, damping: 9 });
    expect(TEMPERAMENTS.halus.overshoot).toBe(0);
    expect(TEMPERAMENTS.punakawan.timeScale).toBe(0.85);
  });
});

describe('pose', () => {
  test('lerpPose interpolates each field', () => {
    const p = lerpPose(REST_POSE, { ...REST_POSE, x: 1 }, 0.25);
    expect(p.x).toBeCloseTo(REST_POSE.x + 0.25 * (1 - REST_POSE.x));
  });
});
