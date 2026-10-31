// The stage player: one canvas, clock, audio and captions; per-play controls swap in on load().
import { createAudio } from './audio/engine';
import { EASE } from './choreo/easing';
import type { Timeline } from './choreo/compile';
import { createClock } from './clock/clock';
import type { ValidationError } from './script/validate';
import { createRenderer } from './stage/render';
import { createCaptions } from './ui/captions';
import { createControls, type ControlsView } from './ui/controls';
import { createDebugPanel, type DebugPanel } from './ui/debug-panel';
import { createEndCard, type EndCard } from './ui/end-card';
import { showLampIntro } from './ui/lamp-intro';

const LAMP_RAMP = 1.2;
const UNLIT = 0.07;

export interface Player {
  /** Lamp intro: waits for the click, unlocks audio, then raises the lamp. */
  light(title: string): Promise<void>;
  /** Treat the lamp as already lit (frozen frames for tests and screenshots). */
  litNow(): void;
  load(tl: Timeline, name: string, opts?: { onAnother?: () => void }): void;
  unload(): void;
  seek(t: number): void;
  play(): void;
  /** Lamp level while no play is loaded (e.g. behind the story card). */
  setIdleDim(dim: number): void;
  showLoadError(name: string, errors: ValidationError[] | string): void;
}

export function createPlayer(root: HTMLElement, opts: { reducedMotion: boolean }): Player {
  const { reducedMotion } = opts;
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

  const clock = createClock(() => performance.now());
  const audio = createAudio();
  const captions = createCaptions(root);
  let tl: Timeline | null = null;
  let ui: { controls: ControlsView; endCard: EndCard; debug: DebugPanel } | null = null;
  let litAt: number | null = null;
  let idleDim = 1;

  const seek = (t: number) => {
    if (!tl) return;
    clock.seek(Math.min(tl.duration, Math.max(0, t)));
    audio.seek(clock.tick());
  };
  const play = () => {
    if (!tl || litAt === null) return;
    if (clock.tick() >= tl.duration) seek(0);
    void audio.unlock();
    clock.play();
  };
  const togglePlay = () => (clock.playing ? clock.pause() : play());

  const unload = () => {
    clock.pause();
    audio.seek(0);
    ui?.controls.destroy();
    ui?.endCard.destroy();
    ui?.debug.destroy();
    ui = null;
    tl = null;
    clock.seek(0);
  };

  const frame = () => {
    const sinceLit = litAt === null ? 0 : (performance.now() - litAt) / 1000;
    const lamp = litAt === null ? UNLIT : UNLIT + (1 - UNLIT) * EASE.out(Math.min(1, sinceLit / LAMP_RAMP));
    if (tl && ui) {
      let t = clock.tick();
      if (t >= tl.duration) {
        if (clock.playing) clock.pause();
        t = tl.duration;
      }
      renderer.draw(tl, t, { reducedMotion, dim: lamp });
      audio.sync(tl.cues, t, clock.playing, t >= tl.duration);
      captions.update(tl.captions, t);
      ui.controls.update(t, clock.playing);
      ui.endCard.update(litAt !== null && t >= tl.duration);
      ui.debug.update(t);
    } else {
      renderer.draw(EMPTY, performance.now() / 1000, { reducedMotion, dim: lamp * idleDim });
      captions.update([], 0);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    async light(title) {
      await showLampIntro(root, title);
      await audio.unlock();
      litAt = performance.now();
      await new Promise((r) => setTimeout(r, LAMP_RAMP * 600));
    },
    litNow() {
      litAt = -Infinity;
    },
    load(next, name, loadOpts = {}) {
      unload();
      tl = next;
      ui = {
        controls: createControls(root, next, {
          togglePlay,
          seek,
          setCaptions: (on) => captions.setVisible(on),
          setMuted: (m) => audio.setMuted(m),
        }),
        endCard: createEndCard(
          root,
          next.title || 'Bayang Eyang',
          () => {
            seek(0);
            play();
          },
          loadOpts.onAnother,
        ),
        debug: createDebugPanel(root, name, { tl: next }),
      };
      if (litAt !== null) ui.controls.show();
    },
    unload,
    seek,
    play,
    setIdleDim(dim) {
      idleDim = dim;
    },
    showLoadError(name, errors) {
      const msg = document.createElement('div');
      msg.className = 'over-stage stage-message';
      msg.innerHTML = `<strong>The dalang can't find this play.</strong><span>Press D for the dalang's notes.</span>`;
      root.appendChild(msg);
      createDebugPanel(root, name, { errors }).open();
      idleDim = 0.3;
    },
  };
}

const EMPTY: Timeline = { title: '', duration: 1, seed: 1, cast: [], scenes: [], actors: {}, cues: [], captions: [], beats: [], spans: [] };
