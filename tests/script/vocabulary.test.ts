import { describe, expect, test } from 'vitest';
import { ACTIONS } from '../../src/script/vocabulary';

describe('action vocabulary', () => {
  test('has 22 actions', () => {
    expect(Object.keys(ACTIONS)).toHaveLength(22);
  });

  test('has 51 styles in total', () => {
    const total = Object.values(ACTIONS).reduce((n, a) => n + a.styles.length, 0);
    expect(total).toBe(51);
  });

  test('attack styles match the spec, default first', () => {
    expect(ACTIONS.attack.styles).toEqual(['thrust', 'sweep', 'slam', 'kick', 'grab', 'charge']);
  });

  test('enter needs a side', () => {
    expect(ACTIONS.enter.needs).toContain('from');
  });
});
