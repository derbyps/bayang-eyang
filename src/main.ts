// Temporary harness (Task 8): replaced by the real app in Task 10.
import { compile } from './choreo/compile';
import { validateLakon } from './script/validate';
import { createRenderer } from './stage/render';

const lakon = {
  version: 1,
  title: 'Harness',
  seed: 7,
  cast: [
    { id: 'gunungan', puppet: 'gunungan', name: 'Gunungan', type: 'halus' },
    { id: 'eyang', puppet: 'eyang-putri', name: 'Eyang Putri', type: 'halus' },
    { id: 'semar', puppet: 'semar', name: 'Semar', type: 'punakawan' },
    { id: 'petruk', puppet: 'petruk', name: 'Petruk', type: 'punakawan' },
    { id: 'bagong', puppet: 'bagong', name: 'Bagong', type: 'punakawan' },
    { id: 'raksasa', puppet: 'raksasa', name: 'Raksasa', type: 'raksasa' },
  ],
  scenes: [{ id: 's', kind: 'jejer', title: 'Jejer', start: 0 }],
  beats: [
    { t: 0, actor: 'eyang', do: 'enter', from: 'left', to: 0.12 },
    { t: 0, actor: 'semar', do: 'enter', from: 'left', to: 0.27 },
    { t: 0, actor: 'gunungan', do: 'enter', from: 'left', to: 0.5 },
    { t: 0, actor: 'petruk', do: 'enter', from: 'right', to: 0.66 },
    { t: 0, actor: 'bagong', do: 'enter', from: 'right', to: 0.78 },
    { t: 0, actor: 'raksasa', do: 'enter', from: 'right', to: 0.92 },
    { t: 3, actor: 'raksasa', do: 'loom', style: 'rise' },
    { t: 6, actor: 'raksasa', do: 'recede' },
    { t: 7, actor: 'petruk', do: 'attack', style: 'sweep', target: 'bagong' },
    { t: 10, actor: 'eyang', do: 'bow' },
  ],
};

const r = validateLakon(lakon);
if (!r.ok) throw new Error(JSON.stringify(r.errors));
const tl = compile(r.lakon);
const canvas = document.createElement('canvas');
document.body.style.margin = '0';
document.body.style.background = '#0B0907';
document.body.appendChild(canvas);
const renderer = createRenderer(canvas);
const params = new URLSearchParams(location.search);
const fixed = params.get('t');
const resize = () => renderer.resize(innerWidth, innerHeight, devicePixelRatio);
resize();
addEventListener('resize', resize);
const start = performance.now();
const frame = () => {
  const t = fixed !== null ? Number(fixed) : ((performance.now() - start) / 1000) % tl.duration;
  renderer.draw(tl, t, { reducedMotion: false, dim: 1 });
  if (fixed === null) requestAnimationFrame(frame);
};
frame();
