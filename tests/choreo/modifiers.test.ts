import { describe, expect, test } from 'vitest';
import { applyModifiers } from '../../src/choreo/modifiers';
import { getTemplate } from '../../src/choreo/templates';
import { mulberry32 } from '../../src/choreo/rng';
import { compile, samplePose, type Timeline } from '../../src/choreo/compile';
import { validateLakon } from '../../src/script/validate';
import { base } from '../helpers/fixtures';

const rand = () => mulberry32(1);
const total = (phases: { dur: number }[]) => phases.reduce((n, p) => n + p.dur, 0);
const kick = () => getTemplate('attack', 'kick');

function tl(extra: Record<string, unknown>[], mutate?: (l: ReturnType<typeof base>) => void): Timeline {
  const l = base(extra);
  mutate?.(l);
  const r = validateLakon(l);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return compile(r.lakon);
}

describe('applyModifiers', () => {
  test('feint adds two phases before the action and lengthens the move', () => {
    const out = applyModifiers(kick(), ['feint'], rand());
    expect(out.phases).toHaveLength(6);
    expect(out.phases.findIndex((p) => p.role === 'action')).toBe(3);
    expect(total(out.phases)).toBeGreaterThan(total(kick().phases));
  });

  test('double performs the action twice', () => {
    const out = applyModifiers(kick(), ['double'], rand());
    expect(out.phases.filter((p) => p.role === 'action')).toHaveLength(2);
  });

  test('miss widens the gap and stumbles', () => {
    const out = applyModifiers(kick(), ['miss'], rand());
    const action = out.phases.find((p) => p.role === 'action')!;
    expect(action.x).toEqual({ kind: 'target', gap: 0.2 });
    const follow = out.phases.find((p) => p.role === 'follow')!;
    expect(Math.abs(follow.pose.tilt ?? 0)).toBeGreaterThan(10);
  });

  test('high and low shift the striking arm', () => {
    const plain = kick().phases[1].pose;
    const high = applyModifiers(kick(), ['high'], rand()).phases.find((p) => p.role === 'action')!.pose;
    const low = applyModifiers(kick(), ['low'], rand()).phases.find((p) => p.role === 'action')!.pose;
    expect((high.shoulderFront ?? 0) - (plain.shoulderFront ?? 0)).toBe(20);
    expect((high.elbowFront ?? 0) - (plain.elbowFront ?? 0)).toBe(15);
    expect((low.shoulderFront ?? 0) - (plain.shoulderFront ?? 0)).toBe(-20);
  });
});

describe('reactions, fling and cues', () => {
  const impactOf = (t: Timeline) => t.cues.find((c) => c.kind === 'sfx' && c.id === 'keprak')!.t;

  test('a successful strike makes the target recoil', () => {
    const t = tl([{ t: 3, actor: 'petruk', do: 'strike', target: 'eyang' }]);
    const hit = impactOf(t);
    const before = samplePose(t, 'eyang', hit - 0.02)!.tilt;
    const after = samplePose(t, 'eyang', hit + 0.15)!.tilt;
    expect(Math.abs(after - before)).toBeGreaterThan(5);
  });

  test('a missed attack does not move the target or ring the keprak', () => {
    const t = tl([
      { t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang', mods: ['miss'] },
      { t: 9, actor: 'eyang', do: 'bow' },
    ]);
    expect(t.cues.some((c) => c.kind === 'sfx' && c.id === 'keprak')).toBe(false);
    let maxDelta = 0;
    const ref = samplePose(t, 'eyang', 3)!.tilt;
    for (let s = 3; s < 5; s += 0.05) maxDelta = Math.max(maxDelta, Math.abs(samplePose(t, 'eyang', s)!.tilt - ref));
    expect(maxDelta).toBeLessThan(3);
  });

  test('fling removes the target from the stage within the move', () => {
    const t = tl([{ t: 3, actor: 'eyang', do: 'fling', target: 'petruk' }]);
    const roll = t.cues.find((c) => c.kind === 'sfx' && c.id === 'cempala-roll');
    expect(roll).toBeDefined();
    expect(samplePose(t, 'petruk', roll!.t - 0.01)).not.toBeNull();
    expect(samplePose(t, 'petruk', roll!.t + 2)).toBeNull();
  });

  test('enter rings a single cempala knock', () => {
    const t = tl([]);
    expect(t.cues).toContainEqual({ t: 0, kind: 'sfx', id: 'cempala-1' });
    expect(t.cues).toContainEqual({ t: 1, kind: 'sfx', id: 'cempala-1' });
  });
});

describe('arm follow-through', () => {
  const settleTime = (t: Timeline, actor: string, from: number) => {
    const target = samplePose(t, actor, from + 3)!.shoulderFront;
    let last = from;
    for (let s = from; s < from + 3; s += 1 / 120) {
      if (Math.abs(samplePose(t, actor, s)!.shoulderFront - target) > 0.5) last = s;
    }
    return last - from;
  };

  test('arms keep moving after the body stops', () => {
    const t = tl([{ t: 3, actor: 'petruk', do: 'strike', style: 'chop', target: 'eyang', speed: 'fast' }]);
    const end = t.spans.find((s) => s.actor === 'petruk' && s.start === 3)!.end;
    const a = samplePose(t, 'petruk', end + 1 / 120)!.shoulderFront;
    const b = samplePose(t, 'petruk', end + 2 / 120)!.shoulderFront;
    const c = samplePose(t, 'petruk', end + 3 / 120)!.shoulderFront;
    expect(a).not.toBeCloseTo(b, 2);
    expect(b).not.toBeCloseTo(c, 2);
  });

  test('a refined puppet settles faster than a clown', () => {
    const beat = [
      { t: 3, actor: 'petruk', do: 'strike', style: 'chop', target: 'eyang' },
      { t: 9, actor: 'eyang', do: 'bow' },
    ];
    const clown = tl(beat);
    const refined = tl(beat, (l) => (l.cast[2].type = 'halus'));
    const endClown = clown.spans.find((s) => s.start === 3)!.end;
    const endRefined = refined.spans.find((s) => s.start === 3)!.end;
    expect(settleTime(refined, 'petruk', endRefined)).toBeLessThan(settleTime(clown, 'petruk', endClown));
  });
});

describe('cut beats', () => {
  test('an attack cut before its impact does not hit', () => {
    const t = tl([
      { t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
      { t: 3.05, actor: 'petruk', do: 'laugh' },
      { t: 9, actor: 'eyang', do: 'bow' },
    ]);
    expect(t.cues.some((c) => c.kind === 'sfx' && c.id === 'keprak')).toBe(false);
  });

  test('a fling cut before its impact leaves the target on stage', () => {
    const t = tl([
      { t: 3, actor: 'eyang', do: 'fling', target: 'petruk' },
      { t: 3.05, actor: 'eyang', do: 'laugh' },
      { t: 9, actor: 'eyang', do: 'bow' },
    ]);
    expect(t.cues.some((c) => c.kind === 'sfx' && c.id === 'cempala-roll')).toBe(false);
    expect(samplePose(t, 'petruk', 6)).not.toBeNull();
  });

  test('an attack that lands before the next beat still hits', () => {
    const t = tl([
      { t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
      { t: 6, actor: 'petruk', do: 'laugh' },
    ]);
    expect(t.cues.some((c) => c.kind === 'sfx' && c.id === 'keprak')).toBe(true);
  });
});
