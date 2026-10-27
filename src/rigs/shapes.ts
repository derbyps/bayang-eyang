// Small path builders for hand-authored wayang silhouettes.
import type { Pt } from './types';

/** A point; a third element of 1 makes it a sharp corner. */
export type Ctl = [number, number] | [number, number, 1];

const f = (n: number) => {
  const s = n.toFixed(4);
  return s === '-0.0000' ? '0' : s.replace(/\.?0+$/, '') || '0';
};

/** Closed Catmull-Rom outline through the points, with optional sharp corners. */
export function outline(points: Ctl[], tension = 0.5): string {
  const n = points.length;
  const p = (i: number) => points[(i + n) % n];
  const sharp = (i: number) => p(i).length === 3;
  let d = `M ${f(p(0)[0])} ${f(p(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const k = tension / 3;
    const c1: Pt = sharp(i) ? [p1[0], p1[1]] : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = sharp(i + 1) ? [p2[0], p2[1]] : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

export function ellipse(cx: number, cy: number, rx: number, ry = rx): string {
  return `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
}

/** An almond-shaped hole centred at (cx, cy), long axis at `angle` radians. */
export function leaf(cx: number, cy: number, len: number, width: number, angle = 0): string {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const vx = -uy, vy = ux;
  const a: Pt = [cx - (ux * len) / 2, cy - (uy * len) / 2];
  const b: Pt = [cx + (ux * len) / 2, cy + (uy * len) / 2];
  const c1: Pt = [cx + vx * width, cy + vy * width];
  const c2: Pt = [cx - vx * width, cy - vy * width];
  return `M ${f(a[0])} ${f(a[1])} Q ${f(c1[0])} ${f(c1[1])} ${f(b[0])} ${f(b[1])} Q ${f(c2[0])} ${f(c2[1])} ${f(a[0])} ${f(a[1])} Z`;
}

export function rect(x: number, y: number, w: number, h: number): string {
  return `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h)} L ${f(x)} ${f(y + h)} Z`;
}

function inside(pt: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Fills a region with a staggered lace pattern of holes. Each hole's
 * bounding points must sit inside the region, so holes never leak outside
 * the body.
 */
export function lace(region: Pt[], spacing: number, hole: 'dot' | 'leaf', size: number): string {
  const xs = region.map((p) => p[0]), ys = region.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const parts: string[] = [];
  let row = 0;
  for (let y = minY + spacing / 2; y < maxY; y += spacing * 0.866, row++) {
    for (let x = minX + spacing / 2 + (row % 2) * (spacing / 2); x < maxX; x += spacing) {
      const r = size * 1.2;
      const probe: Pt[] = [[x, y], [x - r, y], [x + r, y], [x, y - r], [x, y + r]];
      if (!probe.every((p) => inside(p, region))) continue;
      parts.push(hole === 'dot' ? ellipse(x, y, size) : leaf(x, y, size * 2.4, size * 0.9, ((row % 2) * 2 - 1) * 0.5));
    }
  }
  return parts.join(' ');
}

/** A tapered arm segment hanging down from (0, 0) to (0, len). */
export function segment(len: number, w0: number, w1: number): string {
  return outline([
    [-w0 / 2, 0],
    [w0 / 2, 0],
    [w1 / 2, len],
    [0, len + w1 * 0.6],
    [-w1 / 2, len],
  ], 0.3);
}

/** Lower arm ending in a long wayang hand with the fingers curling forward. */
export function forearm(len: number, w0: number, w1: number): string {
  const h = len * 0.22;
  return outline([
    [-w0 / 2, 0],
    [w0 / 2, 0],
    [w1 / 2, len - h],
    [w1 * 1.6, len - h * 0.4],
    [w1 * 2.6, len + h * 0.15, 1],
    [w1 * 0.9, len + h * 0.2],
    [0, len + h * 0.55, 1],
    [-w1 / 2, len - h * 0.2],
  ], 0.4);
}

export function arm(shoulder: Pt, upperLen: number, lowerLen: number, width: number) {
  return {
    shoulder,
    upper: segment(upperLen, width, width * 0.8),
    elbow: [0, upperLen] as Pt,
    lower: forearm(lowerLen, width * 0.8, width * 0.6),
    hand: [width * 1.2, lowerLen + lowerLen * 0.05] as Pt,
  };
}
