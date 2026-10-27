// The closed vocabulary the dalang may use. Styles list the default first.

export type Temperament = 'halus' | 'gagah' | 'raksasa' | 'punakawan';
export type SceneKind = 'gunungan' | 'jejer' | 'perang' | 'gara-gara' | 'tancep-kayon';
export type Side = 'left' | 'right';
export type PuppetKey = 'gunungan' | 'semar' | 'petruk' | 'bagong' | 'raksasa' | 'eyang-putri';
export type Modifier = 'feint' | 'double' | 'miss' | 'high' | 'low';
export type Need = 'from' | 'to' | 'target' | 'line';
export type ActionGroup = 'stage' | 'gesture' | 'combat' | 'light' | 'gunungan' | 'ending';

interface ActionDef {
  group: ActionGroup;
  styles: readonly [string, ...string[]];
  needs: readonly Need[];
}

export const ACTIONS = {
  enter: { group: 'stage', styles: ['glide', 'sneak', 'leap'], needs: ['from'] },
  exit: { group: 'stage', styles: ['glide', 'flee', 'leap'], needs: [] },
  plant: { group: 'stage', styles: ['firm', 'light'], needs: [] },
  cross: { group: 'stage', styles: ['walk', 'hurry'], needs: ['to'] },
  speak: { group: 'gesture', styles: ['calm', 'animated'], needs: ['line'] },
  bow: { group: 'gesture', styles: ['sembah', 'deep'], needs: [] },
  point: { group: 'gesture', styles: ['accuse', 'guide'], needs: ['target'] },
  'look-far': { group: 'gesture', styles: ['shade', 'peer'], needs: [] },
  laugh: { group: 'gesture', styles: ['giggle', 'belly'], needs: [] },
  weep: { group: 'gesture', styles: ['quiet', 'sob'], needs: [] },
  dance: { group: 'gesture', styles: ['kiprah', 'sway'], needs: [] },
  attack: { group: 'combat', styles: ['thrust', 'sweep', 'slam', 'kick', 'grab', 'charge'], needs: ['target'] },
  strike: { group: 'combat', styles: ['jab', 'chop'], needs: ['target'] },
  dodge: { group: 'combat', styles: ['hop', 'duck', 'spin'], needs: [] },
  fling: { group: 'combat', styles: ['spin', 'arc'], needs: ['target'] },
  fall: { group: 'combat', styles: ['crumple', 'flung-off', 'sink'], needs: [] },
  loom: { group: 'light', styles: ['rise', 'rush'], needs: [] },
  recede: { group: 'light', styles: ['drift', 'snap'], needs: [] },
  'gunungan-open': { group: 'gunungan', styles: ['spin', 'rise'], needs: [] },
  'gunungan-close': { group: 'gunungan', styles: ['spin', 'sink'], needs: [] },
  'gunungan-storm': { group: 'gunungan', styles: ['wind', 'fire'], needs: [] },
  linger: { group: 'ending', styles: ['fade'], needs: [] },
} as const satisfies Record<string, ActionDef>;

export type Action = keyof typeof ACTIONS;
export const ACTION_NAMES = Object.keys(ACTIONS) as Action[];
export const MODIFIERS: readonly Modifier[] = ['feint', 'double', 'miss', 'high', 'low'];
export const COMBAT_MOD_ACTIONS = ['attack', 'strike'] as const;
export const PUPPET_KEYS: readonly PuppetKey[] = ['gunungan', 'semar', 'petruk', 'bagong', 'raksasa', 'eyang-putri'];

export function defaultStyle(action: Action): string {
  return ACTIONS[action].styles[0];
}

export function isValidStyle(action: Action, style: string): boolean {
  return (ACTIONS[action].styles as readonly string[]).includes(style);
}
