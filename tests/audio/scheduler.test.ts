import { describe, expect, test } from 'vitest';
import { cuesInWindow, planSchedule, shouldSilence } from '../../src/audio/scheduler';
import type { Cue } from '../../src/choreo/cues';

const cues: Cue[] = [
  { t: 1, kind: 'sfx', id: 'cempala-1' },
  { t: 2, kind: 'sfx', id: 'keprak' },
  { t: 3, kind: 'sfx', id: 'gong' },
];

describe('cuesInWindow', () => {
  test('is half-open: includes from, excludes to', () => {
    expect(cuesInWindow(cues, 1, 2).map((c) => c.t)).toEqual([1]);
    expect(cuesInWindow(cues, 1, 3.0001).map((c) => c.t)).toEqual([1, 2, 3]);
  });
});

describe('planSchedule', () => {
  test('schedules the lookahead window and advances the horizon', () => {
    const plan = planSchedule(cues, 0.9, 0.9, 0.2);
    expect(plan.due.map((c) => c.t)).toEqual([1]);
    expect(plan.scheduledUntil).toBeCloseTo(1.1);
  });

  test('does not reschedule what is already scheduled', () => {
    const plan = planSchedule(cues, 1.1, 1.0, 0.2);
    expect(plan.due).toEqual([]);
  });

  test('seek cancels and reschedules only future cues', () => {
    // After seeking back to 1.5 the engine resets the horizon to 1.5.
    const plan = planSchedule(cues, 1.5, 1.5, 0.6);
    expect(plan.due.map((c) => c.t)).toEqual([2]);
  });

  test('a horizon left behind by a time jump never fires skipped cues in a burst', () => {
    const plan = planSchedule(cues, 0.5, 2.5, 0.2);
    expect(plan.due).toEqual([]);
  });
});

describe('shouldSilence', () => {
  test('a user pause silences ringing voices', () => {
    expect(shouldSilence(true, false, false)).toBe(true);
  });
  test('the natural end of the play lets the last gong ring out', () => {
    expect(shouldSilence(true, false, true)).toBe(false);
  });
  test('nothing to silence when already stopped', () => {
    expect(shouldSilence(false, false, false)).toBe(false);
  });
});
