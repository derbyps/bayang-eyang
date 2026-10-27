import { isActionBeat, type Lakon } from '../../src/script/schema';
import { defaultStyle, type Action, type Modifier } from '../../src/script/vocabulary';

/** Which actions, action/style pairs and modifiers a lakon uses. */
export function coverage(lakon: Lakon) {
  const actions = new Set<Action>();
  const styles = new Set<string>();
  const mods = new Set<Modifier>();
  for (const b of lakon.beats) {
    if (!isActionBeat(b)) continue;
    actions.add(b.do);
    styles.add(`${b.do}/${b.style ?? defaultStyle(b.do)}`);
    for (const m of b.mods ?? []) mods.add(m as Modifier);
  }
  return { actions, styles, mods };
}
