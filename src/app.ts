import { createAudio } from './audio/engine';
import { EASE } from './choreo/easing';
import type { Timeline } from './choreo/compile';
import { createClock } from './clock/clock';
import { DEFAULT_LAKON, loadLakon, type LoadResult } from './load';
import { createRenderer } from './stage/render';
import { createCaptions } from './ui/captions';
import { showLampIntro } from './ui/lamp-intro';

const LAMP_RAMP = 1.2;
const UNLIT = 0.07;

export interface AppContext {
  root: HTMLElement;
  tl: Timeline;
  clock: ReturnType<typeof createClock>;
  audio: ReturnType<typeof createAudio>;
  reducedMotion: boolean;
  lakonName: string;
}

export interface AppHooks {
  /** Runs once the play is loaded; may return a per-frame callback. */
  onReady?(app: AppContext): ((t: number) => void) | void;
  onLoadError?(root: HTMLElement, result: Extract<LoadResult, { ok: false }>, name: string): void;
}

export async function startApp(root: HTMLElement, hooks: AppHooks = {}): Promise<void> {
  const params = new URLSearchParams(location.search);
  const lakonName = params.get('lakon') ?? DEFAULT_LAKON;
  const fixedT = params.get('t');
  const paused = params.get('paused') === '1' || fixedT !== null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A wayang kulit shadow play');
  root.appendChild(canvas);
  const renderer = createRenderer(canvas);

  const layout = () => {
    renderer.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 2));
    const s = renderer.stage;
    root.style.setProperty('--stage-x', `${s.x}px`);
    root.style.setProperty('--stage-y', `${s.y}px`);
    root.style.setProperty('--stage-w', `${s.w}px`);
    root.style.setProperty('--stage-h', `${s.h}px`);
  };
  layout();
  addEventListener('resize', layout);

  const result = await loadLakon(lakonName, { reducedMotion });
  if (!result.ok) {
    hooks.onLoadError?.(root, result, lakonName);
    const empty = emptyTimeline();
    const draw = () => {
      renderer.draw(empty, performance.now() / 1000, { reducedMotion, dim: 0.35 });
      requestAnimationFrame(draw);
    };
    draw();
    return;
  }

  const tl = result.tl;
  const clock = createClock(() => performance.now());
  const audio = createAudio();
  const captions = createCaptions(root);
  const app: AppContext = { root, tl, clock, audio, reducedMotion, lakonName };
  const perFrame = hooks.onReady?.(app) ?? undefined;

  let litAt: number | null = paused ? -Infinity : null;
  if (fixedT !== null) clock.seek(Number(fixedT));

  const frame = () => {
    let t = clock.tick();
    if (t >= tl.duration) {
      clock.pause();
      clock.seek(tl.duration);
      t = tl.duration;
    }
    const sinceLit = litAt === null ? 0 : (performance.now() - litAt) / 1000;
    const dim = litAt === null ? UNLIT : UNLIT + (1 - UNLIT) * EASE.out(Math.min(1, sinceLit / LAMP_RAMP));
    renderer.draw(tl, t, { reducedMotion, dim });
    audio.sync(tl.cues, t, clock.playing);
    captions.update(tl.captions, t);
    perFrame?.(t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (!paused) {
    await showLampIntro(root, tl.cast.length ? lakonTitle(tl) : 'Bayang Eyang');
    await audio.unlock();
    litAt = performance.now();
    setTimeout(() => clock.play(), LAMP_RAMP * 600);
  }
}

function lakonTitle(tl: Timeline): string {
  return tl.scenes[0]?.title ?? 'Bayang Eyang';
}

function emptyTimeline(): Timeline {
  return { duration: 1, seed: 1, cast: [], scenes: [], actors: {}, cues: [], captions: [], beats: [], spans: [] };
}
