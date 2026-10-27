import { describe, expect, test } from 'vitest';
import { getTemplate } from '../../src/choreo/templates';
import { ACTIONS, ACTION_NAMES, type ActionGroup } from '../../src/script/vocabulary';

const RANGES: Record<ActionGroup, [number, number]> = {
  stage: [1.2, 2.0],
  gesture: [0.8, 1.6],
  combat: [0.6, 1.2],
  light: [1.0, 2.0],
  gunungan: [2.0, 3.0],
  ending: [2.7, 2.7],
};

const pairs = ACTION_NAMES.flatMap((a) => ACTIONS[a].styles.map((s) => [a, s] as const));

describe('templates', () => {
  test.each(pairs)('%s/%s has 4 phases in its duration range', (action, style) => {
    const tpl = getTemplate(action, style);
    expect(tpl.phases).toHaveLength(4);
    tpl.phases.forEach((p) => expect(p.dur).toBeGreaterThan(0));
    const total = tpl.phases.reduce((n, p) => n + p.dur, 0);
    const [lo, hi] = RANGES[ACTIONS[action].group];
    expect(total).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(total).toBeLessThanOrEqual(hi + 1e-9);
  });

  test.each(ACTIONS.attack.styles)('attack/%s moves toward the target', (style) => {
    expect(getTemplate('attack', style).phases[1].x?.kind).toBe('target');
  });

  test('unknown style throws', () => {
    expect(() => getTemplate('attack', 'moonwalk')).toThrow();
  });
});
