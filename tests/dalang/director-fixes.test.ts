import { describe, expect, test } from 'vitest';
import { direct } from '../../src/dalang/director';
import { nenekSari } from '../../src/dalang/sample';
import type { Storyboard, StoryMove } from '../../src/dalang/storyboard';
import { compile } from '../../src/choreo/compile';
import { validateLakon } from '../../src/script/validate';
import { isActionBeat } from '../../src/script/schema';

const ok = (sb: Storyboard) => {
  const d = direct(sb, 3);
  const r = validateLakon(d.lakon);
  expect(r.ok ? [] : r.errors).toEqual([]);
  return d;
};
const withMove = (scene: number, at: number, m: StoryMove) => {
  const sb = nenekSari();
  sb.scenes[scene].moves.splice(at, 0, m);
  return sb;
};

describe('cross', () => {
  const beatsOf = (d: ReturnType<typeof direct>, actor: string) => d.lakon.beats.filter(isActionBeat).filter((b) => b.actor === actor);

  test('walks toward the target, then settles back into its own place', () => {
    const d = ok(withMove(1, 1, { who: 'nenek', do: 'cross', target: 'flood' }));
    const mine = beatsOf(d, 'c-nenek');
    const i = mine.findIndex((b) => b.do === 'cross');
    const flood = beatsOf(d, 'c-flood').filter((b) => b.t <= mine[i].t && b.to !== undefined).at(-1)!;
    expect(Math.abs(mine[i].to! - flood.to!)).toBeLessThan(0.2);
    expect(mine[i + 1]).toMatchObject({ do: 'plant' });
    const home = mine.slice(0, i).filter((b) => b.to !== undefined).at(-1)!;
    expect(mine[i + 1].to).toBe(home.to);
  });

  test('without a target, walks a good way across the stage', () => {
    const d = ok(withMove(0, 1, { who: 'nenek', do: 'cross' }));
    const mine = beatsOf(d, 'c-nenek');
    const cross = mine.find((b) => b.do === 'cross')!;
    const home = mine.filter((b) => b.t < cross.t && b.to !== undefined).at(-1)!;
    expect(Math.abs(cross.to! - home.to!)).toBeGreaterThanOrEqual(0.2);
  });
});

describe('missing targets', () => {
  const targetOf = (d: ReturnType<typeof direct>, actor: string, action: string) =>
    d.lakon.beats.filter(isActionBeat).find((b) => b.actor === actor && b.do === action)?.target;

  test('a trouble that attacks without a target attacks the hero', () => {
    const d = ok(withMove(1, 0, { who: 'flood', do: 'strike', style: 'chop' }));
    expect(d.notes).toEqual([]);
    expect(targetOf(d, 'c-flood', 'strike')).toBe('c-nenek');
  });

  test('the hero who attacks without a target attacks a trouble', () => {
    const d = ok(withMove(1, 0, { who: 'nenek', do: 'attack', style: 'thrust' }));
    expect(d.notes).toEqual([]);
    expect(targetOf(d, 'c-nenek', 'attack')).toBe('c-flood');
  });
});

describe('optional targets', () => {
  test('an unknown target on a move that needs none is ignored, not reported', () => {
    const d = ok(withMove(0, 1, { who: 'nenek', do: 'cross', target: 'the garden' }));
    expect(d.notes).toEqual([]);
    expect(d.lakon.beats.filter(isActionBeat).some((b) => b.actor === 'c-nenek' && b.do === 'cross')).toBe(true);
  });
});

describe('silent fixes and notes', () => {
  test('an unknown style becomes the default and is noted', () => {
    const d = ok(withMove(0, 1, { who: 'nenek', do: 'laugh', style: 'moonwalk' }));
    expect(d.notes).toContainEqual(expect.objectContaining({ kind: 'unknown-style', scene: 0, move: 1 }));
    expect(d.lakon.beats.filter(isActionBeat).some((b) => b.do === 'laugh' && b.style === 'giggle')).toBe(true);
  });

  test('an unknown action is dropped and noted', () => {
    const d = ok(withMove(0, 1, { who: 'nenek', do: 'teleport' }));
    expect(d.notes).toContainEqual(expect.objectContaining({ kind: 'unknown-action', scene: 0, move: 1 }));
  });

  test('an unknown actor is dropped and noted', () => {
    const d = ok(withMove(0, 1, { who: 'ghost', do: 'laugh' }));
    expect(d.notes).toContainEqual(expect.objectContaining({ kind: 'unknown-actor', scene: 0, move: 1 }));
  });

  test('director-owned actions from the model are ignored without a note', () => {
    const sb = withMove(0, 1, { who: 'nenek', do: 'enter' });
    sb.scenes[1].moves.push({ who: 'nenek', do: 'linger' }, { who: 'nenek', do: 'gunungan-open' });
    const d = ok(sb);
    expect(d.notes).toEqual([]);
  });

  test('an actor who was flung re-enters before moving again', () => {
    const sb = nenekSari();
    sb.scenes[3].moves.push({ who: 'flood', do: 'laugh', style: 'belly' });
    const beats = ok(sb).lakon.beats.filter(isActionBeat).filter((b) => b.actor === 'c-flood');
    const laughAt = beats.findIndex((b) => b.do === 'laugh');
    expect(beats[laughAt - 1].do).toBe('enter');
  });

  test('back-to-back identical moves rotate the second style', () => {
    const d = ok(withMove(0, 1, { who: 'nenek', do: 'bow', style: 'sembah' }));
    const bows = d.lakon.beats.filter(isActionBeat).filter((b) => b.actor === 'c-nenek' && b.do === 'bow');
    expect(bows[0].style).toBe('sembah');
    expect(bows[1].style).toBe('deep');
  });
});

describe('gongs', () => {
  test('a gong sounds when a trouble is defeated', () => {
    const { lakon } = ok(nenekSari());
    const fling = lakon.beats.filter(isActionBeat).find((b) => b.do === 'fling')!;
    const gongs = lakon.beats.flatMap((b) => ('sfx' in b && b.sfx === 'gong' ? [b.t] : []));
    expect(gongs.some((t) => t > fling.t && t < fling.t + 3)).toBe(true);
  });
});

describe('length', () => {
  test('a play over two minutes is trimmed, keeping the first and last move of each scene', () => {
    const sb = nenekSari();
    for (const s of sb.scenes) {
      while (s.moves.length < 10) s.moves.splice(1, 0, { who: 'nenek', do: 'weep', style: s.moves.length % 2 ? 'quiet' : 'sob' });
    }
    const d = ok(sb);
    expect(d.duration).toBeLessThanOrEqual(120);
    expect(d.notes.some((n) => n.kind === 'trimmed')).toBe(true);
    const actions = d.lakon.beats.filter(isActionBeat);
    expect(actions.some((b) => b.do === 'look-far')).toBe(true); // last move of scene 1
    expect(actions.some((b) => b.do === 'loom')).toBe(true); // first move of scene 2
  });

  test("the director's duration matches the compiled play", () => {
    const d = ok(nenekSari());
    expect(Math.abs(d.duration - compile(d.lakon).duration)).toBeLessThan(1);
  });
});
