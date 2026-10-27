import { describe, expect, test } from 'vitest';
import { compile, samplePose, speakDuration, type Timeline } from '../../src/choreo/compile';
import { validateLakon } from '../../src/script/validate';
import type { Lakon } from '../../src/script/schema';
import { base } from '../helpers/fixtures';

function build(extra: Record<string, unknown>[], mutate?: (l: ReturnType<typeof base>) => void): Lakon {
  const l = base(extra);
  mutate?.(l);
  const r = validateLakon(l);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.lakon;
}

function spanOf(tl: Timeline, beat: number) {
  const s = tl.spans.find((x) => x.beat === beat);
  if (!s) throw new Error(`no span for beat ${beat}`);
  return s;
}

function peak(tl: Timeline, actor: string, start: number, end: number, key: 'shoulderFront'): number {
  let best = 0;
  for (let t = start; t <= end; t += 1 / 120) best = Math.max(best, Math.abs(samplePose(tl, actor, t)?.[key] ?? 0));
  return best;
}

describe('compile', () => {
  test('is deterministic', () => {
    const l = build([{ t: 2, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' }]);
    expect(JSON.stringify(compile(l))).toBe(JSON.stringify(compile(l)));
  });

  test('the same style twice gives different motion', () => {
    const tl = compile(
      build([
        { t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
        { t: 5, actor: 'petruk', do: 'laugh' },
        { t: 7, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
      ]),
    );
    const a = samplePose(tl, 'petruk', spanOf(tl, 2).start + 0.3)!;
    const b = samplePose(tl, 'petruk', spanOf(tl, 4).start + 0.3)!;
    expect(a.shoulderFront).not.toBeCloseTo(b.shoulderFront, 1);
  });

  test('temperament scales timing', () => {
    const kick = [{ t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' }];
    const fast = spanOf(compile(build(kick)), 2);
    const slow = spanOf(
      compile(build(kick, (l) => (l.cast[2].type = 'halus'))),
      2,
    );
    const ratio = (slow.end - slow.start) / (fast.end - fast.start);
    expect(ratio).toBeGreaterThan((1.3 / 0.85) * 0.85);
    expect(ratio).toBeLessThan((1.3 / 0.85) * 1.15);
  });

  test('combat escalates with each repeat', () => {
    const tl = compile(
      build([
        { t: 3, actor: 'eyang', do: 'attack', style: 'thrust', target: 'petruk', intensity: 0.6 },
        { t: 5, actor: 'eyang', do: 'laugh' },
        { t: 7, actor: 'eyang', do: 'attack', style: 'thrust', target: 'petruk', intensity: 0.6 },
        { t: 9, actor: 'eyang', do: 'laugh', style: 'belly' },
        { t: 11, actor: 'eyang', do: 'attack', style: 'thrust', target: 'petruk', intensity: 0.6 },
      ]),
    );
    const first = spanOf(tl, 2), third = spanOf(tl, 6);
    expect(peak(tl, 'eyang', third.start, third.end, 'shoulderFront')).toBeGreaterThan(
      peak(tl, 'eyang', first.start, first.end, 'shoulderFront') + 5,
    );
  });

  test('actors are off stage before enter and after exit', () => {
    const tl = compile(build([{ t: 3, actor: 'petruk', do: 'exit' }]));
    expect(samplePose(tl, 'petruk', 0.5)).toBeNull();
    expect(samplePose(tl, 'petruk', 2)).not.toBeNull();
    expect(samplePose(tl, 'petruk', spanOf(tl, 2).end + 0.1)).toBeNull();
  });

  test('overlapping beat retargets without a jump', () => {
    const tl = compile(
      build([
        { t: 2.5, actor: 'petruk', do: 'cross', to: 0.2 },
        { t: 3.0, actor: 'petruk', do: 'laugh' },
      ]),
    );
    const before = samplePose(tl, 'petruk', 2.999)!;
    const after = samplePose(tl, 'petruk', 3.001)!;
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.01);
  });

  test('reduced motion removes idle sway', () => {
    const tl = compile(build([{ t: 9, actor: 'eyang', do: 'bow' }]), { reducedMotion: true });
    const a = samplePose(tl, 'eyang', 3)!.tilt;
    const b = samplePose(tl, 'eyang', 4.2)!.tilt;
    expect(a).toBeCloseTo(b, 6);
  });

  test('idle sway keeps a planted puppet alive', () => {
    const tl = compile(build([{ t: 9, actor: 'eyang', do: 'bow' }]));
    expect(samplePose(tl, 'eyang', 3)!.tilt).not.toBeCloseTo(samplePose(tl, 'eyang', 4.2)!.tilt, 3);
  });

  test('speak creates a caption with the cast name', () => {
    const tl = compile(build([{ t: 3, actor: 'petruk', do: 'speak', line: 'Only the rice tin.' }]));
    expect(tl.captions).toEqual([{ start: 3, end: 4.5, speaker: 'Petruk', text: 'Only the rice tin.' }]);
  });

  test('narration and sound beats become captions and cues', () => {
    const tl = compile(build([{ t: 3, narrate: 'Long ago...' }, { t: 3.5, sfx: 'gong' }, { t: 4, music: 'war' }]));
    expect(tl.captions[0].speaker).toBeNull();
    expect(tl.cues).toContainEqual({ t: 3.5, kind: 'sfx', id: 'gong' });
    expect(tl.cues).toContainEqual({ t: 4, kind: 'music', pattern: 'war' });
  });
});

describe('speakDuration', () => {
  test('is at least 1.5 s and grows with length', () => {
    expect(speakDuration('hi')).toBe(1.5);
    expect(speakDuration('a'.repeat(70))).toBe(5);
  });

  test('counts only the visible words of glossary terms', () => {
    expect(speakDuration(`[[sembah|${'a long hidden meaning '.repeat(5)}]]`)).toBe(1.5);
  });
});
