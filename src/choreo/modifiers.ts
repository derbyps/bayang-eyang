import type { Modifier } from '../script/vocabulary';
import type { Phase, Template } from './templates';

const MISS_EXTRA_GAP = 0.08;
const STUMBLE: Phase = {
  role: 'follow',
  dur: 0.3,
  ease: 'out',
  pose: { tilt: 18, y: 0.01, shoulderFront: 20, shoulderBack: -15 },
};

function scalePose(pose: Phase['pose'], k: number): Phase['pose'] {
  const out: Phase['pose'] = {};
  for (const [key, v] of Object.entries(pose) as [keyof Phase['pose'], number][]) {
    out[key] = key === 'depth' || key === 'opacity' || key === 'flipX' ? v : v * k;
  }
  return out;
}

/** Rewrites a combat template for the given modifiers. Never mutates the input. */
export function applyModifiers(tpl: Template, mods: Modifier[], rand: () => number): Template {
  let phases = tpl.phases.map((p) => ({ ...p, pose: { ...p.pose } }));
  const actionIndex = () => phases.findIndex((p) => p.role === 'action');

  for (const m of ['high', 'low'] as const) {
    if (!mods.includes(m)) continue;
    const sign = m === 'high' ? 1 : -1;
    const a = phases[actionIndex()];
    a.pose.shoulderFront = (a.pose.shoulderFront ?? 0) + 20 * sign;
    a.pose.elbowFront = (a.pose.elbowFront ?? 0) + 15 * sign;
  }

  if (mods.includes('miss')) {
    const a = phases[actionIndex()];
    if (a.x?.kind === 'target') a.x = { kind: 'target', gap: a.x.gap + MISS_EXTRA_GAP };
    phases = phases.map((p) => (p.role === 'follow' ? { ...STUMBLE, pose: { ...STUMBLE.pose } } : p));
  }

  if (mods.includes('feint')) {
    const i = actionIndex();
    const windUp = phases[0];
    const depth = 0.5 + rand() * 0.2;
    const fake: Phase = { role: 'feint', dur: 0.18, ease: 'out', pose: scalePose(phases[i].pose, depth) };
    const pullBack: Phase = { role: 'feint', dur: 0.16, ease: 'inOut', pose: scalePose(windUp.pose, 1.1) };
    phases.splice(i, 0, fake, pullBack);
  }

  if (mods.includes('double')) {
    const i = actionIndex();
    const recoil: Phase = { role: 'recoil', dur: 0.14, ease: 'out', pose: scalePose(phases[0].pose, 0.6) };
    const again: Phase = { ...phases[i], pose: { ...phases[i].pose }, x: undefined };
    phases.splice(i + 1, 0, recoil, again);
  }

  return { phases };
}
