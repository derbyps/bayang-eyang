// While the dalang writes, puppets rise from the kotak (puppet chest), one by one.
import type { DalangEvent } from '../dalang/pipeline';
import { getRig } from '../rigs';
import type { PuppetKey } from '../script/vocabulary';

type CastEvent = Extract<DalangEvent, { type: 'cast' }>;
const LINES = {
  casting: 'The dalang is choosing puppets…',
  scenes: 'Writing the scenes…',
  checking: 'Checking the play…',
  repairing: 'Mending a scene…',
} as const;
const ROLE: Record<string, string> = { hero: 'hero', ally: 'ally', trouble: 'trouble', clown: 'clown', elder: 'elder' };

export interface PuppetChest {
  cast(e: CastEvent): void;
  progress(stage: keyof typeof LINES): void;
  repair(round: number): void;
  /** Shows a gentle message with a way to the ready-made play; resolves when chosen. */
  rest(message: string): Promise<void>;
  close(): Promise<void>;
}

/** Draws a leather puppet (the dalang's side): tan hide, holes cut through. */
function drawPuppet(canvas: HTMLCanvasElement, key: PuppetKey) {
  const rig = getRig(key);
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 128;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const size = h * 0.92;
  g.translate(w / 2, h * 0.97);
  g.scale(size, size);
  g.fillStyle = '#C99A5B';
  g.strokeStyle = '#3A2414';
  g.lineWidth = 0.006;
  const body = new Path2D(`${rig.body} ${rig.perforation}`);
  if (rig.arms) {
    for (const arm of [rig.arms.back, rig.arms.front]) {
      g.save();
      g.translate(arm.shoulder[0], arm.shoulder[1]);
      g.rotate((-20 * Math.PI) / 180);
      g.fill(new Path2D(arm.upper));
      g.translate(arm.elbow[0], arm.elbow[1]);
      g.rotate((-25 * Math.PI) / 180);
      g.fill(new Path2D(arm.lower));
      g.restore();
    }
  }
  g.fill(body, 'evenodd');
  g.stroke(body);
}

export function createPuppetChest(root: HTMLElement): PuppetChest {
  const el = document.createElement('section');
  el.className = 'over-stage chest';
  el.setAttribute('aria-label', 'The puppet chest');
  el.innerHTML = `
    <p class="chest-line" aria-live="polite">${LINES.casting}</p>
    <ul class="chest-cast"></ul>
    <div class="chest-box" aria-hidden="true"><span class="chest-lid"></span></div>
    <div class="chest-rest" hidden>
      <p class="chest-rest-text"></p>
      <button class="chest-demo" type="button">Watch Eyang Putri</button>
    </div>`;
  root.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => (el.dataset.state = 'open')));
  const line = el.querySelector<HTMLElement>('.chest-line')!;
  const list = el.querySelector<HTMLUListElement>('.chest-cast')!;
  let repairs = 0;

  return {
    cast(e) {
      list.innerHTML = '';
      e.cast.forEach((c, i) => {
        const li = document.createElement('li');
        li.className = 'chest-puppet';
        li.style.setProperty('--i', String(i));
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const name = document.createElement('strong');
        name.textContent = c.name;
        const role = document.createElement('span');
        role.className = 'chest-role';
        role.textContent = ROLE[c.role] ?? c.role;
        const why = document.createElement('span');
        why.className = 'chest-why';
        why.textContent = c.why;
        li.append(canvas, name, role, why);
        list.appendChild(li);
        drawPuppet(canvas, c.puppet as PuppetKey);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => (list.dataset.state = 'shown')));
    },
    progress(stage) {
      if (stage === 'repairing') return;
      line.textContent = repairs && stage === 'checking' ? `The dalang mended ${repairs} mistake${repairs > 1 ? 's' : ''}. Checking again…` : LINES[stage];
    },
    repair(round) {
      repairs = round;
      line.textContent = LINES.repairing;
    },
    rest(message) {
      const rest = el.querySelector<HTMLElement>('.chest-rest')!;
      el.querySelector('.chest-rest-text')!.textContent = message;
      line.hidden = true;
      rest.hidden = false;
      return new Promise((resolve) =>
        rest.querySelector('button')!.addEventListener('click', () => resolve(), { once: true }),
      );
    },
    close() {
      el.dataset.state = 'closing';
      return new Promise((resolve) =>
        setTimeout(() => {
          el.remove();
          resolve();
        }, 420),
      );
    },
  };
}
