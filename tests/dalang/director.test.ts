import { describe, expect, test } from 'vitest';
import { direct, estimateMove, MAX_ON_STAGE } from '../../src/dalang/director';
import { nenekSari } from '../../src/dalang/sample';
import { getTemplate } from '../../src/choreo/templates';
import { validateLakon } from '../../src/script/validate';
import { isActionBeat, type ActionBeat } from '../../src/script/schema';
import type { Modifier } from '../../src/script/vocabulary';

const actionBeats = (seed = 1) => direct(nenekSari(), seed).lakon.beats.filter(isActionBeat);

describe('direct', () => {
  test('produces a lakon the checker accepts', () => {
    const r = validateLakon(direct(nenekSari(), 1).lakon);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  test('opens with the gunungan and closes with tancep kayon, the hero lingering last', () => {
    const { lakon } = direct(nenekSari(), 1);
    expect(lakon.scenes[0].kind).toBe('gunungan');
    expect(lakon.scenes.at(-1)!.kind).toBe('tancep-kayon');
    const last = lakon.beats.filter(isActionBeat).at(-1)!;
    expect(last.do).toBe('linger');
    expect(last.actor).toBe('c-nenek');
  });

  test("every actor's first move is an entrance", () => {
    const first = new Map<string, ActionBeat>();
    for (const b of actionBeats()) if (!first.has(b.actor)) first.set(b.actor, b);
    for (const b of first.values()) expect(b.do).toBe('enter');
  });

  test(`never more than ${MAX_ON_STAGE} puppets on stage`, () => {
    const on = new Set<string>();
    for (const b of actionBeats()) {
      if (b.do === 'enter') on.add(b.actor);
      if (b.do === 'exit' || b.do === 'fall' || b.do === 'linger') on.delete(b.actor);
      if (b.do === 'fling' && b.target) on.delete(b.target);
      expect(on.size).toBeLessThanOrEqual(MAX_ON_STAGE);
    }
  });

  test('no actor starts a move before their previous one ends', () => {
    const last = new Map<string, ActionBeat>();
    const { lakon } = direct(nenekSari(), 1);
    const typeOf = new Map(lakon.cast.map((c) => [c.id, c.type]));
    for (const b of lakon.beats.filter(isActionBeat)) {
      const prev = last.get(b.actor);
      if (prev) {
        const est = estimateMove(prev.do, prev.style!, typeOf.get(prev.actor)!, (prev.mods ?? []) as Modifier[]);
        expect(b.t).toBeGreaterThanOrEqual(prev.t + est - 1e-6);
      }
      last.set(b.actor, b);
    }
  });

  test('is deterministic, and the seed changes the opening', () => {
    expect(direct(nenekSari(), 1)).toEqual(direct(nenekSari(), 1));
    const opening = (s: number) => direct(nenekSari(), s).lakon.beats.filter(isActionBeat).find((b) => b.do === 'gunungan-open')!.style;
    const styles = new Set(Array.from({ length: 10 }, (_, i) => opening(i + 1)));
    expect(styles.size).toBeGreaterThan(1);
  });

  test('music follows the scene kinds', () => {
    const { lakon } = direct(nenekSari(), 1);
    const music = lakon.beats.flatMap((b) => ('music' in b ? [b.music] : []));
    expect(music).toEqual(['calm', 'calm', 'war', 'playful', 'calm', 'calm']);
  });
});

test('estimateMove sums the template and scales by temperament', () => {
  const sum = getTemplate('attack', 'kick').phases.reduce((n, p) => n + p.dur, 0);
  expect(estimateMove('attack', 'kick', 'punakawan', [])).toBeCloseTo(sum * 0.85, 9);
});
