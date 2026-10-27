import { DEFAULT_LAKON, loadLakon } from './load';
import { createPlayer } from './player';
import { GUNUNGAN_INK } from './ui/icons';

export async function startApp(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const named = params.get('lakon');
  const fixedT = params.get('t');
  const paused = params.get('paused') === '1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.innerHTML = `<span class="end-mark">${GUNUNGAN_INK}</span><p>Turn your phone sideways to watch the play.</p><small>The shadow screen is wide, like a real kelir.</small>`;
  root.appendChild(hint);

  const player = createPlayer(root, { reducedMotion });

  // A named play (or a frozen frame) goes straight to the stage.
  const name = named ?? DEFAULT_LAKON;
  const result = await loadLakon(name, { reducedMotion });
  if (!result.ok) {
    player.litNow();
    player.showLoadError(name, result.errors);
    return;
  }
  player.load(result.tl, name);
  if (fixedT !== null) player.seek(Number(fixedT));
  if (paused) {
    player.litNow();
    return;
  }
  await player.light(result.tl.title || 'Bayang Eyang');
  player.play();
}
