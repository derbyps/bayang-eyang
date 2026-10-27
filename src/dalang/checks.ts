// Creative problems in a storyboard, phrased for the model to fix in a repair round.
import { isActionBeat, type Lakon } from '../script/schema';
import { ACTIONS, type Action } from '../script/vocabulary';
import { MIN_LEN, type Directed } from './director';
import { STORY_ACTIONS, type Storyboard } from './storyboard';

const DIRECTOR_OWNED = new Set(['enter', 'exit', 'plant', 'linger', 'gunungan-open', 'gunungan-close', 'gunungan-storm']);
const DOMINANCE = 0.4;

export function storyChecks(sb: Storyboard, d: Directed): string[] {
  const problems: string[] = [];
  const lost = new Set(d.notes.filter((n) => n.kind !== 'unknown-style').map((n) => `${n.scene}:${n.move}`));
  const kept = sb.scenes.map((s, si) => s.moves.filter((m, mi) => !lost.has(`${si}:${mi}`) && !DIRECTOR_OWNED.has(m.do)));
  const where = (si: number, mi: number) => `Scene ${si + 1} ("${sb.scenes[si].title}"), move ${mi + 1}`;

  for (const n of d.notes) {
    const m = sb.scenes[n.scene]?.moves[n.move];
    if (!m) continue;
    if (n.kind === 'unknown-style') {
      const styles = (ACTIONS[m.do as Action]?.styles ?? []).join(', ');
      problems.push(`${where(n.scene, n.move)}: "${m.who}" uses ${m.do}/${m.style}; ${m.do} styles are ${styles}.`);
    } else if (n.kind === 'unknown-action') {
      problems.push(`${where(n.scene, n.move)}: "${m.do}" is not a move. Use one of: ${STORY_ACTIONS.join(', ')}.`);
    } else if (n.kind === 'unknown-actor') {
      problems.push(`${where(n.scene, n.move)}: ${n.detail}. The cast ids are: ${sb.cast.map((c) => c.id).join(', ')}.`);
    } else if (n.kind === 'dropped') {
      problems.push(`${where(n.scene, n.move)}: ${n.detail}.`);
    }
  }

  if (!sb.scenes.some((s) => s.kind === 'gara-gara')) {
    problems.push(`Add a gara-gara scene where the clowns joke about the hero's habit.`);
  }

  const hero = sb.cast.find((c) => c.role === 'hero');
  if (hero) {
    const scenes = kept.filter((ms) => ms.some((m) => m.who === hero.id || m.target === hero.id)).length;
    if (scenes < 2) problems.push(`The hero, ${hero.name}, appears in ${scenes} scene(s); give the hero moves in at least two scenes.`);
  }

  kept.forEach((ms, si) => {
    if (ms.length < 3) problems.push(`Scene "${sb.scenes[si].title}" needs at least 3 moves that work; it has ${ms.length}.`);
  });

  if (d.duration < MIN_LEN) {
    problems.push(`The play lasts ${Math.round(d.duration)} s; add a scene or more moves so it lasts at least a minute.`);
  }

  const counts = new Map<string, number>();
  const all = kept.flat();
  for (const m of all) counts.set(m.do, (counts.get(m.do) ?? 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  if (all.length && n / all.length > DOMINANCE) {
    const others = STORY_ACTIONS.filter((a) => !counts.has(a)).slice(0, 6).join(', ');
    problems.push(`Most moves are "${top}" (${Math.round((100 * n) / all.length)}%); use more kinds of moves, such as ${others}.`);
  }
  return problems;
}

/** How varied a directed play is (bookend scenes and stage mechanics excluded). */
export function variety(lakon: Lakon): { scenes: number; actionStyles: number; puppets: number } {
  const story = lakon.beats.filter(isActionBeat).filter((b) => !DIRECTOR_OWNED.has(b.do));
  const actors = new Set(story.map((b) => b.actor));
  return {
    scenes: lakon.scenes.filter((s) => s.kind !== 'gunungan' && s.kind !== 'tancep-kayon').length,
    actionStyles: new Set(story.map((b) => `${b.do}/${b.style}`)).size,
    puppets: new Set(lakon.cast.filter((c) => actors.has(c.id)).map((c) => c.puppet)).size,
  };
}
