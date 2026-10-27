import type { CaptionSpan } from '../choreo/cues';
import { parseCaption } from './caption-text';

export interface CaptionView {
  update(captions: CaptionSpan[], t: number): void;
  setVisible(visible: boolean): void;
}

function render(span: CaptionSpan): HTMLElement {
  const el = document.createElement('p');
  el.className = span.speaker ? 'caption' : 'caption narration';
  if (span.speaker) {
    const who = document.createElement('span');
    who.className = 'speaker';
    who.textContent = span.speaker;
    el.appendChild(who);
  }
  for (const part of parseCaption(span.text)) {
    if ('text' in part) {
      el.appendChild(document.createTextNode(part.text));
      continue;
    }
    const term = document.createElement('span');
    term.className = 'term';
    term.tabIndex = 0;
    term.lang = 'jv';
    term.textContent = part.term;
    const meaning = document.createElement('span');
    meaning.className = 'term-meaning';
    meaning.setAttribute('role', 'tooltip');
    meaning.lang = 'en';
    meaning.textContent = part.meaning;
    term.appendChild(meaning);
    el.appendChild(term);
  }
  return el;
}

export function createCaptions(root: HTMLElement): CaptionView {
  const layer = document.createElement('div');
  layer.className = 'over-stage captions';
  layer.setAttribute('aria-live', 'polite');
  root.appendChild(layer);
  let current: CaptionSpan | null = null;
  let currentEl: HTMLElement | null = null;

  return {
    update(captions, t) {
      const next = captions.find((c) => t >= c.start && t < c.end) ?? null;
      if (next === current) return;
      current = next;
      const old = currentEl;
      if (old) {
        old.dataset.state = 'exit';
        setTimeout(() => old.remove(), 170);
      }
      currentEl = null;
      if (next) {
        const el = render(next);
        el.dataset.state = 'enter';
        layer.appendChild(el);
        requestAnimationFrame(() => requestAnimationFrame(() => delete el.dataset.state));
        currentEl = el;
      }
    },
    setVisible(visible) {
      layer.style.visibility = visible ? 'visible' : 'hidden';
    },
  };
}
