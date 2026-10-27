import type { PuppetKey, Temperament } from '../script/vocabulary';

export type Pt = [number, number];

/**
 * One arm, in puppet-local units (puppet height = 1, origin at the feet,
 * y negative upward, facing +x). Each segment hangs straight down (+y)
 * from its pivot at angle 0.
 */
export interface ArmRig {
  shoulder: Pt;
  upper: string;
  /** Elbow pivot, relative to the shoulder in the upper arm's frame. */
  elbow: Pt;
  lower: string;
  /** Hand point (rod attachment), relative to the elbow in the lower arm's frame. */
  hand: Pt;
}

export interface Rig {
  key: PuppetKey;
  defaultType: Temperament | null;
  /** Puppet height in stage-y units. */
  height: number;
  body: string;
  /** Closed sub-paths cut out of the body with even-odd fill. */
  perforation: string;
  arms: { back: ArmRig; front: ArmRig } | null;
  /** Where the main rod (gapit) leaves the body, in local units. */
  rodAnchor: Pt;
}
