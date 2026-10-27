import { expect, test } from 'vitest';
import { fitStage } from '../../src/stage/layout';

test('fitStage letterboxes 16:9 in a tall viewport', () => {
  expect(fitStage(1000, 1000)).toEqual({ x: 0, y: 218.75, w: 1000, h: 562.5 });
});

test('fitStage pillarboxes 16:9 in a wide viewport', () => {
  const r = fitStage(1920, 800);
  expect(r.h).toBe(800);
  expect(r.w).toBeCloseTo(1422.22, 1);
  expect(r.x).toBeCloseTo((1920 - 1422.22) / 2, 1);
  expect(r.y).toBe(0);
});
