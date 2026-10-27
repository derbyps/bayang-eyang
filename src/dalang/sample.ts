// A fictional, hand-written storyboard: the canonical sample for tests, the fake provider and the eval.
import type { Casting, StoryInput, Storyboard } from './storyboard';

export const SAMPLE_STORY: StoryInput = {
  who: 'Nenek Sari, my grandmother',
  loved: 'her rice tin, kroncong on the radio, and feeding every neighbour',
  hardship: 'the 1981 flood took her rice fields in one night',
  habit: 'she hid money in the rice tin and called it her bank',
  language: 'en',
};

export const SAMPLE_CASTING: Casting = {
  title: 'Nenek Sari and the Flood',
  language: 'en',
  cast: [
    { id: 'nenek', name: 'Nenek Sari', puppet: 'eyang-putri', type: 'halus', role: 'hero', why: 'gentle, but nothing could move her' },
    { id: 'flood', name: 'The Flood', puppet: 'raksasa', type: 'raksasa', role: 'trouble', why: 'it swallowed the rice fields in one night' },
    { id: 'semar', name: 'Semar', puppet: 'semar', type: 'punakawan', role: 'elder', why: 'the wise servant who has seen every flood' },
    { id: 'petruk', name: 'Petruk', puppet: 'petruk', type: 'punakawan', role: 'clown', why: 'he knows where the money is hidden' },
    { id: 'bagong', name: 'Bagong', puppet: 'bagong', type: 'punakawan', role: 'clown', why: 'he never understands the joke' },
  ],
};

export const SAMPLE_SCENES: Pick<Storyboard, 'scenes'> = {
  scenes: [
    {
      kind: 'jejer',
      title: 'The Village',
      narration: ['In a village by the river lived Nenek Sari.', 'Every neighbour knew the smell of her kitchen.'],
      moves: [
        { who: 'nenek', do: 'bow', style: 'sembah' },
        { who: 'nenek', do: 'speak', style: 'calm', line: 'Come in, come in. There is always rice.' },
        { who: 'semar', do: 'speak', style: 'calm', line: 'The river is talking tonight, Nenek.' },
        { who: 'nenek', do: 'look-far', style: 'shade' },
      ],
    },
    {
      kind: 'perang',
      title: 'The Flood',
      narration: ['In 1981 the river rose like a [[raksasa|a giant; in wayang, the shape every great trouble takes]].'],
      moves: [
        { who: 'flood', do: 'loom', style: 'rise' },
        { who: 'flood', do: 'recede', style: 'drift' },
        { who: 'flood', do: 'attack', style: 'sweep', target: 'nenek' },
        { who: 'nenek', do: 'dodge', style: 'hop' },
        { who: 'flood', do: 'attack', style: 'slam', target: 'nenek', mods: ['miss'] },
        { who: 'nenek', do: 'point', style: 'accuse', target: 'flood' },
        { who: 'nenek', do: 'strike', style: 'jab', target: 'flood' },
        { who: 'nenek', do: 'fling', style: 'arc', target: 'flood' },
      ],
    },
    {
      kind: 'gara-gara',
      title: 'The Rice Tin',
      narration: ['[[Gara-gara|the comic interlude, when the clown-servants take over]]!'],
      moves: [
        { who: 'petruk', do: 'laugh', style: 'belly' },
        { who: 'petruk', do: 'speak', style: 'animated', line: 'The flood took the fields, but never the rice tin!' },
        { who: 'bagong', do: 'speak', style: 'calm', line: 'Best bank in the village. No admin fees.' },
        { who: 'bagong', do: 'attack', style: 'kick', target: 'petruk', mods: ['low', 'miss'] },
        { who: 'bagong', do: 'fall', style: 'crumple' },
        { who: 'petruk', do: 'laugh', style: 'giggle' },
      ],
    },
    {
      kind: 'jejer',
      title: 'Fifty Years On',
      narration: ['The fields came back. So did the neighbours.', 'The rice tin still sits in her kitchen.'],
      moves: [
        { who: 'nenek', do: 'dance', style: 'sway' },
        { who: 'semar', do: 'speak', style: 'calm', line: 'Some things the river cannot carry away.' },
        { who: 'nenek', do: 'bow', style: 'deep' },
      ],
    },
  ],
};

export function nenekSari(): Storyboard {
  return structuredClone({ ...SAMPLE_CASTING, ...SAMPLE_SCENES });
}
