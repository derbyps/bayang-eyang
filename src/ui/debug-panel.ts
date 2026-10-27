import type { Timeline } from '../choreo/compile';
import type { ValidationError } from '../script/validate';

export interface DebugPanel {
  update(t: number): void;
  open(): void;
}

const PLAYS = ['demo-eyang-putri', 'showcase'];

function describe(b: Timeline['beats'][number]): string {
  if ('do' in b) {
    const parts = [b.actor, `${b.do}${b.style ? `/${b.style}` : ''}`];
    if (b.target) parts.push(`→ ${b.target}`);
    if (b.mods?.length) parts.push(`+${b.mods.join('+')}`);
    return parts.join(' ');
  }
  if ('narrate' in b) return `narrate “${b.narrate.slice(0, 40)}…”`;
  if ('sfx' in b) return `sfx ${b.sfx}`;
  return `music ${b.music}`;
}

/** Developer notes (toggle with D): the script, the current beat and validation status. */
export function createDebugPanel(
  root: HTMLElement,
  current: string,
  data: { tl: Timeline } | { errors: ValidationError[] | string },
): DebugPanel {
  const panel = document.createElement('aside');
  panel.className = 'debug';
  panel.setAttribute('aria-label', 'Dalang notes');
  panel.hidden = true;
  panel.innerHTML = `
    <header><strong>Dalang notes</strong><span data-t>t 0.00</span><span data-fps></span></header>
    <label>Play <select data-play></select></label>
    <div data-status class="debug-status"></div>
    <ol data-beats class="debug-beats"></ol>`;
  root.appendChild(panel);
  // Play names can come from the URL: build options as text, never as markup.
  const select = panel.querySelector<HTMLSelectElement>('[data-play]')!;
  for (const name of new Set([current, ...PLAYS])) select.add(new Option(name, name, false, name === current));
  select.addEventListener('change', (e) => {
    const url = new URL(location.href);
    url.searchParams.set('lakon', (e.target as HTMLSelectElement).value);
    url.searchParams.delete('t');
    url.searchParams.delete('paused');
    location.href = url.toString();
  });

  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  const list = panel.querySelector<HTMLOListElement>('[data-beats]')!;
  const tEl = panel.querySelector<HTMLElement>('[data-t]')!;
  const fpsEl = panel.querySelector<HTMLElement>('[data-fps]')!;

  let rows: HTMLLIElement[] = [];
  let tl: Timeline | null = null;
  if ('tl' in data) {
    tl = data.tl;
    status.textContent = `valid ✓ · ${tl.beats.length} beats · ${tl.duration.toFixed(1)} s`;
    rows = tl.beats.map((b) => {
      const li = document.createElement('li');
      li.textContent = `${b.t.toFixed(1).padStart(5)}  ${describe(b)}`;
      list.appendChild(li);
      return li;
    });
  } else {
    status.dataset.error = 'true';
    const errs = typeof data.errors === 'string' ? [data.errors] : data.errors.map((e) => `${e.rule}: ${e.message}`);
    status.innerHTML = '';
    for (const msg of errs) {
      const p = document.createElement('p');
      p.textContent = msg;
      status.appendChild(p);
    }
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      if (e.target instanceof HTMLSelectElement) return;
      panel.hidden = !panel.hidden;
    }
  });

  let active = -1;
  let last = performance.now();
  let fps = 60;
  return {
    open() {
      panel.hidden = false;
    },
    update(t) {
      const n = performance.now();
      fps = fps * 0.9 + (1000 / Math.max(1, n - last)) * 0.1;
      last = n;
      if (panel.hidden || !tl) return;
      tEl.textContent = `t ${t.toFixed(2)}`;
      fpsEl.textContent = `${Math.round(fps)} fps`;
      const span = [...tl.spans].reverse().find((s) => t >= s.start && t <= s.end);
      const idx = span ? span.beat : -1;
      if (idx !== active) {
        rows[active]?.removeAttribute('aria-current');
        active = idx;
        const row = rows[active];
        if (row) {
          row.setAttribute('aria-current', 'true');
          row.scrollIntoView({ block: 'nearest' });
        }
      }
    },
  };
}
