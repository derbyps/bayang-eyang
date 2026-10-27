import type { PuppetKey } from '../script/vocabulary';
import type { Rig } from './types';
import { bagong } from './bagong';
import { eyangPutri } from './eyang-putri';
import { gunungan } from './gunungan';
import { petruk } from './petruk';
import { raksasa } from './raksasa';
import { semar } from './semar';

export type { ArmRig, Pt, Rig } from './types';

const RIGS: Record<PuppetKey, Rig> = {
  gunungan,
  semar,
  petruk,
  bagong,
  raksasa,
  'eyang-putri': eyangPutri,
};

export function getRig(key: PuppetKey): Rig {
  return RIGS[key];
}
