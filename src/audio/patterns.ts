// Gamelan underscore in the slendro scale: five near-equal steps per octave.
export const SLENDRO_HZ: readonly number[] = Array.from({ length: 10 }, (_, i) => 220 * 2 ** ((i * 240) / 1200));

export type Pattern = 'calm' | 'war' | 'playful' | 'stop';

export interface Note {
  t: number;
  degree: number;
  gong: boolean;
}

interface PatternDef {
  step: number;
  gongEvery: number;
  melody: number[];
  swing?: number;
}

// Short balungan-like cycles, as scale degrees (0-9).
const PATTERNS: Record<Exclude<Pattern, 'stop'>, PatternDef> = {
  calm: { step: 1, gongEvery: 8, melody: [2, 3, 5, 3, 2, 1, 2, 0] },
  war: { step: 0.25, gongEvery: 4, melody: [5, 6, 5, 3, 5, 6, 7, 6, 5, 3, 2, 3, 5, 6, 5, 3] },
  playful: { step: 0.4, gongEvery: 6.4, melody: [6, 5, 7, 5, 6, 3, 5, 2], swing: 0.06 },
};

/** Notes in [from, to), in seconds relative to the pattern's start. */
export function patternNotes(p: Pattern, from: number, to: number): Note[] {
  if (p === 'stop') return [];
  const def = PATTERNS[p];
  const notes: Note[] = [];
  const first = Math.max(0, Math.ceil(from / def.step - 1e-9));
  for (let k = first; k * def.step < to; k++) {
    const base = k * def.step;
    const t = base + (def.swing && k % 2 === 1 ? def.swing : 0);
    if (t < from || t >= to) continue;
    const gong = Math.abs(base / def.gongEvery - Math.round(base / def.gongEvery)) < 1e-9;
    notes.push({ t, degree: def.melody[k % def.melody.length], gong });
  }
  return notes;
}
