import type { Pt, Rig } from './types';
import { lace, leaf, outline, rect } from './shapes';

// The gunungan (kayon): the tree-of-life mountain that opens and closes every play.
const leafBody: Pt[] = [
  [0.27, -0.24], [0.3, -0.38], [0.25, -0.58], [0.13, -0.8], [0, -0.95], [-0.13, -0.8],
  [-0.25, -0.58], [-0.3, -0.38], [-0.27, -0.24],
];

function branches(): string {
  const parts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const y = -0.32 - i * 0.085;
    const spread = 0.2 - i * 0.022;
    for (const side of [-1, 1]) {
      for (let j = 1; j <= 3; j++) {
        const x = side * spread * (j / 3);
        parts.push(leaf(x, y - j * 0.018, 0.045, 0.011, side * (0.6 + j * 0.15)));
      }
    }
  }
  return parts.join(' ');
}

export const gunungan: Rig = {
  key: 'gunungan',
  defaultType: null,
  height: 0.75,
  body: outline([
    [0.22, 0, 1], [0.22, -0.16, 1], [0.3, -0.22], [0.33, -0.38], [0.27, -0.6], [0.14, -0.82],
    [0, -1, 1], [-0.14, -0.82], [-0.27, -0.6], [-0.33, -0.38], [-0.3, -0.22], [-0.22, -0.16, 1],
    [-0.22, 0, 1],
  ]),
  perforation: [
    branches(),
    lace(leafBody, 0.06, 'dot', 0.006),
    rect(-0.12, -0.15, 0.07, 0.12),
    rect(0.05, -0.15, 0.07, 0.12),
    rect(-0.025, -0.13, 0.05, 0.1),
  ].join(' '),
  arms: null,
  rodAnchor: [0, -0.3],
};
