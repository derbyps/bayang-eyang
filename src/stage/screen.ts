import type { Lamp } from './light';
import type { Rect } from './layout';
import { COLOR, TRUNK_Y } from './palette';

let weave: HTMLCanvasElement | null = null;

/** A faint cloth texture, generated once: horizontal and vertical threads plus grain. */
function weaveTexture(): HTMLCanvasElement {
  if (weave) return weave;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const thread = (y % 3 === 0 ? 26 : 0) + (x % 3 === 0 ? 18 : 0);
      const v = 128 - thread + (rand() - 0.5) * 50;
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  weave = c;
  return c;
}

/** The lit kelir: lamp glow, cloth weave and edge falloff. */
export function drawScreen(ctx: CanvasRenderingContext2D, r: Rect, lamp: Lamp, dim: number) {
  const a = Math.max(0, Math.min(1.2, lamp.intensity * dim));
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const unit = r.h / 720;
  const cx = r.x + r.w * 0.5 + lamp.dx * unit;
  const cy = r.y + r.h * 0.34 + lamp.dy * unit;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.62);
  glow.addColorStop(0, `rgba(255, 226, 150, ${0.97 * a})`);
  glow.addColorStop(0.18, `rgba(255, 195, 0, ${0.9 * a})`);
  glow.addColorStop(0.48, `rgba(255, 107, 53, ${0.62 * a})`);
  glow.addColorStop(0.78, `rgba(84, 30, 12, ${0.45 * a})`);
  glow.addColorStop(1, 'rgba(11, 9, 7, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.save();
  ctx.globalAlpha = 0.09 * Math.min(1, a);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(weaveTexture(), 'repeat')!;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Foreground pieces drawn over the puppets: the banana trunk and the screen trim. */
export function drawFrame(ctx: CanvasRenderingContext2D, r: Rect) {
  const top = r.y + r.h * TRUNK_Y;
  const trunk = ctx.createLinearGradient(0, top, 0, r.y + r.h);
  trunk.addColorStop(0, '#2A160B');
  trunk.addColorStop(0.08, COLOR.trunk);
  trunk.addColorStop(1, '#070504');
  ctx.fillStyle = trunk;
  ctx.fillRect(r.x, top, r.w, r.y + r.h - top);

  ctx.fillStyle = COLOR.teal;
  ctx.fillRect(r.x, r.y, r.w, r.h * 0.022);
  ctx.fillRect(r.x, r.y + r.h * 0.988, r.w, r.h * 0.012);
}
