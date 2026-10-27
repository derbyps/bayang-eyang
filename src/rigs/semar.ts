import type { Rig } from './types';
import { arm, ellipse, lace, outline } from './shapes';

// Semar: the wise clown-servant, round-backed and big-bottomed, face turned up, with his tuft.
export const semar: Rig = {
  key: 'semar',
  defaultType: 'punakawan',
  height: 0.4,
  body: outline([
    [0.16, 0, 1], [0.22, -0.12], [0.27, -0.34], [0.19, -0.55], [0.15, -0.65], [0.175, -0.7],
    [0.21, -0.76, 1], [0.15, -0.8], [0.13, -0.9], [0.135, -0.97, 1], [0.07, -0.975],
    [-0.03, -0.925], [-0.08, -0.81], [-0.15, -0.63], [-0.3, -0.4], [-0.29, -0.18],
    [-0.22, -0.06], [-0.08, 0, 1],
  ]),
  perforation: [
    lace([[0.18, -0.12], [0.2, -0.34], [-0.2, -0.34], [-0.22, -0.16], [-0.12, -0.06], [0.1, -0.06]], 0.045, 'leaf', 0.011),
    ellipse(0.11, -0.82, 0.011),
  ].join(' '),
  arms: {
    back: arm([-0.04, -0.6], 0.25, 0.27, 0.04),
    front: arm([0.04, -0.6], 0.25, 0.27, 0.042),
  },
  rodAnchor: [0, -0.45],
};
