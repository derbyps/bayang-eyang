import type { Lakon } from '../../src/script/schema';

type AnyBeat = Record<string, unknown>;

/** A valid two-actor lakon used as the starting point for rule tests. */
export function base(extraBeats: AnyBeat[] = []): Lakon & { beats: AnyBeat[] } {
  return {
    version: 1,
    title: 'Fixture',
    seed: 7,
    cast: [
      { id: 'gunungan', puppet: 'gunungan', name: 'Gunungan', type: 'halus' },
      { id: 'eyang', puppet: 'eyang-putri', name: 'Eyang Putri', type: 'halus' },
      { id: 'petruk', puppet: 'petruk', name: 'Petruk', type: 'punakawan' },
    ],
    scenes: [{ id: 's1', kind: 'jejer', title: 'Jejer', start: 0 }],
    beats: [
      { t: 0, actor: 'eyang', do: 'enter', from: 'left' },
      { t: 1, actor: 'petruk', do: 'enter', from: 'right' },
      ...extraBeats,
    ],
  } as Lakon & { beats: AnyBeat[] };
}
