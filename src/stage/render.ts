import { samplePose, type Timeline } from '../choreo/compile';
import { getRig } from '../rigs';
import { fitStage, type Rect } from './layout';
import { lampAt } from './light';
import { drawPuppet } from './puppet';
import { drawFrame, drawScreen } from './screen';
import { COLOR } from './palette';

export interface DrawOptions {
  reducedMotion: boolean;
  /** Lamp brightness multiplier: 0 = dark, 1 = full. */
  dim: number;
}

export interface Renderer {
  resize(vw: number, vh: number, dpr: number): void;
  draw(tl: Timeline, t: number, opts: DrawOptions): void;
  readonly stage: Rect;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d')!;
  // Use the blur filter once up front so its first real use (a looming shadow) doesn't stall a frame.
  ctx.filter = 'blur(4px)';
  ctx.fillRect(0, 0, 2, 2);
  ctx.filter = 'none';
  let stage: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let dpr = 1;
  let vw = 1, vh = 1;

  return {
    get stage() {
      return stage;
    },
    resize(w, h, ratio) {
      vw = w;
      vh = h;
      dpr = ratio;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      stage = fitStage(w, h);
    },
    draw(tl, t, opts) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = COLOR.page;
      ctx.fillRect(0, 0, vw, vh);
      const lamp = lampAt(t, tl.seed, opts.reducedMotion);
      const dim = opts.dim * lingerDim(tl, t);

      ctx.save();
      ctx.beginPath();
      ctx.rect(stage.x, stage.y, stage.w, stage.h);
      ctx.clip();
      drawScreen(ctx, stage, lamp, dim);

      const live = tl.cast
        .map((c) => ({ c, pose: samplePose(tl, c.id, t) }))
        .filter((a): a is { c: (typeof a)['c']; pose: NonNullable<(typeof a)['pose']> } => a.pose !== null)
        .sort((a, b) => b.pose.depth - a.pose.depth);
      for (const { c, pose } of live) {
        drawPuppet(ctx, stage, getRig(tl.actors[c.id].rig), pose, lamp, { reducedMotion: opts.reducedMotion });
      }
      drawFrame(ctx, stage);
      ctx.restore();
    },
  };
}

/** After the last linger begins, the lamp sinks to 70%. */
export function lingerDim(tl: Timeline, t: number): number {
  const linger = tl.spans.find((s) => {
    const b = tl.beats[s.beat];
    return b && 'do' in b && b.do === 'linger';
  });
  if (!linger || t <= linger.start) return 1;
  const k = Math.min(1, (t - linger.start) / 1.5);
  return 1 - 0.3 * (k * k * (3 - 2 * k));
}
