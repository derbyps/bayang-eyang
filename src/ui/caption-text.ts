export type CaptionPart = { text: string } | { term: string; meaning: string };

const TERM = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

/** Splits caption text into plain runs and `[[term|meaning]]` glossary terms. */
export function parseCaption(text: string): CaptionPart[] {
  const parts: CaptionPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ term: m[1], meaning: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
