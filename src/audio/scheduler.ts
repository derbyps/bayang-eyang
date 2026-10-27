import type { Cue } from '../choreo/cues';

/** Cues with from <= t < to, in time order (input must be sorted). */
export function cuesInWindow(cues: Cue[], from: number, to: number): Cue[] {
  return cues.filter((c) => c.t >= from && c.t < to);
}

/**
 * What to schedule this frame. Starts at the later of the horizon and now, so a horizon
 * left behind by a seek or a sleeping tab never fires the skipped cues at once.
 */
export function planSchedule(cues: Cue[], scheduledUntil: number, t: number, lookahead: number) {
  const from = Math.max(scheduledUntil, t);
  const to = t + lookahead;
  return { due: to > from ? cuesInWindow(cues, from, to) : [], scheduledUntil: Math.max(scheduledUntil, to) };
}

/** Whether stopping playback should cut ringing voices: yes for a pause, no when the play simply ends. */
export function shouldSilence(wasPlaying: boolean, playing: boolean, ended: boolean): boolean {
  return wasPlaying && !playing && !ended;
}
