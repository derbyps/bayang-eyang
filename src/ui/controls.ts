import type { Timeline } from '../choreo/compile';
import { ICON } from './icons';

export interface ControlsActions {
  togglePlay(): void;
  seek(t: number): void;
  setCaptions(on: boolean): void;
  setMuted(muted: boolean): void;
}

export interface ControlsView {
  update(t: number, playing: boolean): void;
  show(): void;
}

const IDLE_MS = 2500;

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createControls(root: HTMLElement, tl: Timeline, act: ControlsActions): ControlsView {
  const bar = document.createElement('div');
  bar.className = 'over-stage controls';
  bar.dataset.visible = 'false';
  const dur = tl.duration;
  const markers = tl.scenes
    .map((s, i) => {
      const next = tl.scenes[i + 1]?.start ?? dur;
      const room = ((next - s.start) / dur) * 100;
      return `<button class="scene" type="button" style="left:${(s.start / dur) * 100}%;--room:${room}%" data-t="${s.start}"><span></span></button>`;
    })
    .join('');
  bar.innerHTML = `
    <div class="controls-row">
      <div class="controls-left">
        <button class="ctl ctl-primary" type="button" data-act="play" aria-label="Play">${ICON.play}</button>
        <span class="time" aria-hidden="true"><span data-now>0:00</span> / ${clock(dur)}</span>
      </div>
      <div class="controls-right">
        <button class="ctl" type="button" data-act="cc" aria-label="Captions" aria-pressed="true">${ICON.captions}</button>
        <button class="ctl" type="button" data-act="mute" aria-label="Mute" aria-pressed="false">${ICON.sound}</button>
      </div>
    </div>
    <div class="scenes">${markers}</div>
    <div class="scrub" role="slider" tabindex="0" aria-label="Play position" aria-valuemin="0" aria-valuemax="${dur.toFixed(1)}" aria-valuenow="0">
      <div class="scrub-track"><div class="scrub-fill"></div></div>
      ${tl.scenes.map((s) => `<i class="scrub-tick" style="left:${(s.start / dur) * 100}%"></i>`).join('')}
      <div class="scrub-thumb"></div>
    </div>`;
  root.appendChild(bar);

  const playBtn = bar.querySelector<HTMLButtonElement>('[data-act="play"]')!;
  const ccBtn = bar.querySelector<HTMLButtonElement>('[data-act="cc"]')!;
  const muteBtn = bar.querySelector<HTMLButtonElement>('[data-act="mute"]')!;
  const nowEl = bar.querySelector<HTMLElement>('[data-now]')!;
  const scrub = bar.querySelector<HTMLElement>('.scrub')!;
  const fill = bar.querySelector<HTMLElement>('.scrub-fill')!;
  const thumb = bar.querySelector<HTMLElement>('.scrub-thumb')!;
  const sceneBtns = [...bar.querySelectorAll<HTMLButtonElement>('.scene')];
  // Scene titles come from the script (soon written by a model): set them as text.
  sceneBtns.forEach((b, i) => {
    b.setAttribute('aria-label', `Jump to ${tl.scenes[i].title}`);
    b.querySelector('span')!.textContent = tl.scenes[i].title;
  });

  let hideTimer = 0;
  const show = () => {
    bar.dataset.visible = 'true';
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!bar.matches(':hover') && !bar.contains(document.activeElement)) bar.dataset.visible = 'false';
      else show();
    }, IDLE_MS);
  };
  addEventListener('pointermove', show);
  addEventListener('pointerdown', show);

  playBtn.addEventListener('click', () => act.togglePlay());
  ccBtn.addEventListener('click', () => {
    const on = ccBtn.getAttribute('aria-pressed') !== 'true';
    ccBtn.setAttribute('aria-pressed', String(on));
    act.setCaptions(on);
  });
  muteBtn.addEventListener('click', () => {
    const muted = muteBtn.getAttribute('aria-pressed') !== 'true';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    muteBtn.innerHTML = muted ? ICON.muted : ICON.sound;
    act.setMuted(muted);
  });
  for (const b of sceneBtns) b.addEventListener('click', () => act.seek(Number(b.dataset.t)));

  const seekFromPointer = (e: PointerEvent) => {
    const r = scrub.getBoundingClientRect();
    act.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur);
  };
  scrub.addEventListener('pointerdown', (e) => {
    scrub.setPointerCapture(e.pointerId);
    scrub.dataset.dragging = 'true';
    seekFromPointer(e);
  });
  scrub.addEventListener('pointermove', (e) => {
    if (scrub.dataset.dragging === 'true') seekFromPointer(e);
  });
  const endDrag = () => delete scrub.dataset.dragging;
  scrub.addEventListener('pointerup', endDrag);
  scrub.addEventListener('pointercancel', endDrag);

  // Keyboard actions are instant: no animation for things pressed many times.
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const t = Number(scrub.getAttribute('aria-valuenow'));
    if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      act.togglePlay();
    } else if (e.key === 'ArrowRight') act.seek(Math.min(dur, t + 5));
    else if (e.key === 'ArrowLeft') act.seek(Math.max(0, t - 5));
  });

  let lastPlaying: boolean | null = null;
  let lastScene = -1;
  return {
    show,
    update(t, playing) {
      const k = Math.min(1, t / dur);
      fill.style.transform = `scaleX(${k})`;
      thumb.style.transform = `translateX(${k * scrub.clientWidth}px) translate(-50%, -50%)`;
      scrub.setAttribute('aria-valuenow', t.toFixed(1));
      scrub.setAttribute('aria-valuetext', clock(t));
      nowEl.textContent = clock(t);
      if (playing !== lastPlaying) {
        lastPlaying = playing;
        playBtn.innerHTML = playing ? ICON.pause : t >= dur ? ICON.replay : ICON.play;
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      }
      let scene = 0;
      tl.scenes.forEach((s, i) => (t >= s.start ? (scene = i) : null));
      if (scene !== lastScene) {
        lastScene = scene;
        sceneBtns.forEach((b, i) => (i === scene ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
      }
    },
  };
}
