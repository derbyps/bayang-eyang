import { describe, expect, test } from 'vitest';
import { createClock } from '../../src/clock/clock';

function fake() {
  let ms = 0;
  return { now: () => ms, advance: (d: number) => (ms += d) };
}

describe('clock', () => {
  test('advances while playing and holds while paused', () => {
    const f = fake();
    const c = createClock(f.now);
    c.play();
    for (let i = 0; i < 20; i++) {
      f.advance(50);
      c.tick();
    }
    expect(c.tick()).toBeCloseTo(1.0);
    c.pause();
    f.advance(1000);
    expect(c.tick()).toBeCloseTo(1.0);
    expect(c.playing).toBe(false);
  });

  test('seek jumps and rate scales time', () => {
    const f = fake();
    const c = createClock(f.now);
    c.seek(30);
    expect(c.tick()).toBe(30);
    c.setRate(0.5);
    c.play();
    for (let i = 0; i < 20; i++) {
      f.advance(50);
      c.tick();
    }
    expect(c.tick()).toBeCloseTo(30.5);
  });

  test('large frame gap does not advance more than maxStep', () => {
    const f = fake();
    const c = createClock(f.now);
    c.play();
    c.tick();
    f.advance(10_000);
    expect(c.tick()).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  test('seek clamps at zero', () => {
    const c = createClock(fake().now);
    c.seek(-4);
    expect(c.tick()).toBe(0);
  });
});
