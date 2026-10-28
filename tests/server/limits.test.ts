import { describe, expect, test } from 'vitest';
import { costOf, createBudget, createRateLimiter } from '../../server/limits';

const HOUR = 3_600_000;

describe('rate limiter', () => {
  test('allows five plays an hour per visitor, then says when to come back', () => {
    let now = 0;
    const rl = createRateLimiter({ limit: 5, windowMs: HOUR, now: () => now });
    for (let i = 0; i < 5; i++) {
      expect(rl.take('a').ok).toBe(true);
      now += 60_000;
    }
    const sixth = rl.take('a');
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) {
      expect(sixth.retryAfterMin).toBeGreaterThanOrEqual(1);
      expect(sixth.retryAfterMin).toBeLessThanOrEqual(60);
    }
    expect(rl.take('b').ok).toBe(true);
    now += HOUR;
    expect(rl.take('a').ok).toBe(true);
  });
});

describe('budget', () => {
  test('stops at the daily cap and resets at UTC midnight', () => {
    let now = Date.UTC(2026, 9, 29, 22, 0);
    const b = createBudget({ dailyUsd: 0.5, now: () => now });
    expect(b.canSpend()).toBe(true);
    b.record(0.3);
    expect(b.canSpend()).toBe(true);
    b.record(0.25);
    expect(b.canSpend()).toBe(false);
    expect(b.resetsInMin()).toBe(120);
    now = Date.UTC(2026, 9, 30, 0, 1);
    expect(b.canSpend()).toBe(true);
  });
});

describe('costOf', () => {
  test('prices Gemma 4 on Cloudflare Workers AI per million tokens', () => {
    expect(costOf('@cf/google/gemma-4-26b-a4b-it', { input: 1e6, output: 1e6 })).toBeCloseTo(0.4, 5);
  });
  test('local and unknown models are free', () => {
    expect(costOf('gemma4:e2b', { input: 1e6, output: 1e6 })).toBe(0);
  });
});
