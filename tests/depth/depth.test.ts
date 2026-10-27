import { expect, test } from 'vitest';
import { depthToShadow } from '../../src/stage/depth';

test('depth 0 is a sharp, full shadow', () => {
  expect(depthToShadow(0)).toEqual({ scale: 1, blur: 0, opacity: 1 });
});

test('depth 0.5 doubles size and blurs', () => {
  const s = depthToShadow(0.5);
  expect(s.scale).toBeCloseTo(2);
  expect(s.blur).toBeCloseTo(12);
  expect(s.opacity).toBeCloseTo(0.7);
});

test('depth is clamped to 0.6', () => {
  expect(depthToShadow(0.9)).toEqual(depthToShadow(0.6));
});
