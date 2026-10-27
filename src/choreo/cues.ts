import type { MusicBeat, SfxBeat } from '../script/schema';

export type Cue = { t: number; kind: 'sfx'; id: SfxBeat['sfx'] } | { t: number; kind: 'music'; pattern: MusicBeat['music'] };

export interface CaptionSpan {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

const CHARS_PER_SECOND = 14;

export function speakDuration(line: string): number {
  return Math.max(1.5, line.length / CHARS_PER_SECOND);
}

export function sortCues(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.t - b.t);
}

/** Captions never overlap: an earlier one ends when the next begins. */
export function trimCaptions(spans: CaptionSpan[]): CaptionSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  return sorted.map((c, i) => {
    const next = sorted[i + 1];
    return next && next.start < c.end ? { ...c, end: next.start } : c;
  });
}
