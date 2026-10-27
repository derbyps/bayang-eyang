import { compile } from './choreo/compile';
import { requestPlay } from './dalang/client';
import type { Lakon } from './script/schema';
import { validateLakon } from './script/validate';
import { DEFAULT_LAKON, loadLakon } from './load';
import { createPlayer, type Player } from './player';
import { GUNUNGAN_INK } from './ui/icons';
import { createPuppetChest } from './ui/puppet-chest';
import { showStoryCard } from './ui/story-card';

const STORY_DIM = 0.45;

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

  // A named play or a frozen frame goes straight to the stage.
  if (named !== null || fixedT !== null || paused) {
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
    return;
  }

  // The bare site: light the lamp, then ask for a story.
  player.setIdleDim(STORY_DIM);
  await player.light('Bayang Eyang');
  void storyLoop(root, player, reducedMotion);
}

async function storyLoop(root: HTMLElement, player: Player, reducedMotion: boolean): Promise<void> {
  const again = () => {
    player.unload();
    void storyLoop(root, player, reducedMotion);
  };
  const playDemo = async () => {
    const demo = await loadLakon(DEFAULT_LAKON, { reducedMotion });
    if (demo.ok) {
      player.load(demo.tl, DEFAULT_LAKON, { onAnother: again });
      player.play();
    }
  };

  const story = await showStoryCard(root);
  if (story === 'demo') return playDemo();

  const chest = createPuppetChest(root);
  let lakon: Lakon | null = null;
  let resting: string | null = null;
  await requestPlay(story, (e) => {
    if (e.type === 'progress') chest.progress(e.stage);
    else if (e.type === 'cast') chest.cast(e);
    else if (e.type === 'repair') chest.repair(e.round);
    else if (e.type === 'done') lakon = e.lakon;
    else if (e.type === 'resting') resting = `The dalang is resting. Try again in ${e.retryAfterMin} minutes, or watch a ready-made play.`;
    else if (e.type === 'unavailable') resting = 'The dalang cannot be reached right now. Watch a ready-made play instead.';
  });

  const checked = lakon ? validateLakon(lakon) : null;
  if (!checked?.ok) {
    await chest.rest(resting ?? 'The dalang lost the thread of this story. Watch a ready-made play instead.');
    await chest.close();
    return playDemo();
  }
  await chest.close();
  player.load(compile(checked.lakon, { reducedMotion }), 'your-story', { onAnother: again });
  player.play();
}
