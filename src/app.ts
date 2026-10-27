import { createAudio } from './audio/engine';
import { EASE } from './choreo/easing';
import type { Timeline } from './choreo/compile';
import { createClock } from './clock/clock';
import { DEFAULT_LAKON, loadLakon } from './load';
import { createRenderer } from './stage/render';
import { createCaptions } from './ui/captions';
import { createControls } from './ui/controls';
import { createDebugPanel } from './ui/debug-panel';
import { createEndCard } from './ui/end-card';
import { GUNUNGAN_INK } from './ui/icons';
import { showLampIntro } from './ui/lamp-intro';

const LAMP_RAMP = 1.2;
const UNLIT = 0.07;

export async function startApp(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const lakonName = params.get('lakon') ?? DEFAULT_LAKON;
  const fixedT = params.get('t');
  const paused = params.get('paused') === '1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.innerHTML = `<span class="end-mark">${GUNUNGAN_INK}</span><p>Turn your phone sideways to watch the play.</p><small>The shadow screen is wide, like a real kelir.</small>`;
  root.appendChild(hint);

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
    const msg = document.createElement('div');
    msg.className = 'over-stage stage-message';
    msg.innerHTML = `<strong>The dalang can't find this play.</strong><span>Press D for the dalang's notes.</span>`;
    root.appendChild(msg);
    createDebugPanel(root, lakonName, { errors: result.errors }).open();
    const empty = emptyTimeline();
    const draw = () => {
      renderer.draw(empty, performance.now() / 1000, { reducedMotion, dim: 0.3 });
      requestAnimationFrame(draw);
    };
    draw();
    return;
  }

  const tl = result.tl;
  const clock = createClock(() => performance.now());
  const audio = createAudio();
  const captions = createCaptions(root);
  const debug = createDebugPanel(root, lakonName, { tl });
  let litAt: number | null = paused ? -Infinity : null;

  const seek = (t: number) => {
    clock.seek(Math.min(tl.duration, Math.max(0, t)));
    audio.seek(clock.tick());
  };
  const togglePlay = () => {
    if (litAt === null) return;
    if (clock.playing) clock.pause();
    else {
      if (clock.tick() >= tl.duration) seek(0);
      void audio.unlock();
      clock.play();
    }
  };
  const controls = createControls(root, tl, {
    togglePlay,
    seek,
    setCaptions: (on) => captions.setVisible(on),
    setMuted: (m) => audio.setMuted(m),
  });
  const endCard = createEndCard(root, titleOf(tl), () => {
    seek(0);
    void audio.unlock();
    clock.play();
  });

  if (fixedT !== null) seek(Number(fixedT));

  const frame = () => {
    let t = clock.tick();
    if (t >= tl.duration) {
      if (clock.playing) clock.pause();
      t = tl.duration;
    }
    const sinceLit = litAt === null ? 0 : (performance.now() - litAt) / 1000;
    const dim = litAt === null ? UNLIT : UNLIT + (1 - UNLIT) * EASE.out(Math.min(1, sinceLit / LAMP_RAMP));
    renderer.draw(tl, t, { reducedMotion, dim });
    audio.sync(tl.cues, t, clock.playing);
    captions.update(tl.captions, t);
    controls.update(t, clock.playing);
    endCard.update(litAt !== null && t >= tl.duration);
    debug.update(t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (!paused) {
    await showLampIntro(root, titleOf(tl));
    await audio.unlock();
    litAt = performance.now();
    controls.show();
    setTimeout(() => clock.play(), LAMP_RAMP * 600);
  }
}

function titleOf(tl: Timeline): string {
  return tl.title || 'Bayang Eyang';
}

function emptyTimeline(): Timeline {
  return { title: '', duration: 1, seed: 1, cast: [], scenes: [], actors: {}, cues: [], captions: [], beats: [], spans: [] };
}
