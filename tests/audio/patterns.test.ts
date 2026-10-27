import { describe, expect, test } from 'vitest';
import { SLENDRO_HZ, patternNotes } from '../../src/audio/patterns';

describe('slendro scale', () => {
  test('starts at 220 Hz with five near-equal steps per octave', () => {
    expect(SLENDRO_HZ[0]).toBe(220);
    expect(SLENDRO_HZ[5]).toBeCloseTo(440, 0);
    expect(SLENDRO_HZ).toHaveLength(10);
  });
});

describe('patternNotes', () => {
  test('war plays four notes a second', () => {
    expect(patternNotes('war', 0, 1)).toHaveLength(4);
  });

  test('calm plays one note a second', () => {
    expect(patternNotes('calm', 0, 4)).toHaveLength(4);
  });

  test('gong marks the start of calm and war', () => {
    expect(patternNotes('war', 0, 1)[0].gong).toBe(true);
    expect(patternNotes('calm', 0, 1)[0].gong).toBe(true);
    expect(patternNotes('war', 4, 4.5)[0].gong).toBe(true);
    expect(patternNotes('war', 1, 2).some((n) => n.gong)).toBe(false);
  });

  test('stop plays nothing', () => {
    expect(patternNotes('stop', 0, 5)).toEqual([]);
  });
});

describe('windowed scheduling', () => {
  test.each(['calm', 'war', 'playful'] as const)('%s plays the same notes in 1/60 s windows as all at once', (p) => {
    const whole = patternNotes(p, 0, 8);
    const windowed = [];
    for (let i = 0; i < 8 * 60; i++) windowed.push(...patternNotes(p, i / 60, (i + 1) / 60));
    expect(windowed.map((n) => n.t)).toEqual(whole.map((n) => n.t));
  });
});
