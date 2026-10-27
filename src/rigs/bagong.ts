import type { Rig } from './types';
import { arm, ellipse, lace, outline } from './shapes';

// Bagong: round and short, with a wide open mouth and a big belly.
export const bagong: Rig = {
  key: 'bagong',
  defaultType: 'punakawan',
  height: 0.38,
  body: outline([
    [0.15, 0, 1], [0.2, -0.1], [0.3, -0.35], [0.21, -0.55], [0.22, -0.62], [0.27, -0.66, 1],
    [0.16, -0.685, 1], [0.28, -0.725, 1], [0.245, -0.79], [0.18, -0.85], [0.06, -0.95],
    [-0.1, -0.9], [-0.15, -0.76], [-0.2, -0.55], [-0.24, -0.3], [-0.2, -0.08], [-0.08, 0, 1],
  ]),
  perforation: [
    lace([[0.18, -0.1], [0.2, -0.32], [-0.17, -0.32], [-0.17, -0.09], [0.1, -0.06]], 0.045, 'dot', 0.011),
    ellipse(0.15, -0.8, 0.016),
  ].join(' '),
  arms: {
    back: arm([-0.04, -0.6], 0.25, 0.26, 0.042),
    front: arm([0.05, -0.6], 0.25, 0.26, 0.045),
  },
  rodAnchor: [0, -0.45],
};
