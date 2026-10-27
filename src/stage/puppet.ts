import type { Pose } from '../choreo/pose';
import type { ArmRig, Pt, Rig } from '../rigs';
import type { Lamp } from './light';
import type { Rect } from './layout';
import { depthToShadow } from './depth';
import { COLOR } from './palette';

const bodyPaths = new WeakMap<Rig, Path2D>();
const armPaths = new WeakMap<ArmRig, { upper: Path2D; lower: Path2D }>();
const RAD = Math.PI / 180;

function bodyPath(rig: Rig): Path2D {
  let p = bodyPaths.get(rig);
  if (!p) {
    p = new Path2D(`${rig.body} ${rig.perforation}`);
    bodyPaths.set(rig, p);
  }
  return p;
}

function armPath(arm: ArmRig) {
  let p = armPaths.get(arm);
  if (!p) {
    p = { upper: new Path2D(arm.upper), lower: new Path2D(arm.lower) };
    armPaths.set(arm, p);
  }
  return p;
}

function apply(m: DOMMatrix, pt: Pt): Pt {
  return [m.a * pt[0] + m.c * pt[1] + m.e, m.b * pt[0] + m.d * pt[1] + m.f];
}

export interface PuppetDrawOptions {
  reducedMotion: boolean;
}

/** Draws one puppet's shadow, with its rods, onto the lit screen. */
export function drawPuppet(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  rig: Rig,
  pose: Pose,
  lamp: Lamp,
  opts: PuppetDrawOptions,
) {
  if (pose.opacity <= 0.001) return;
  const unit = r.h / 720;
  const shadow = depthToShadow(pose.depth);
  const scale = opts.reducedMotion ? 1 : shadow.scale;

  // Nearing the lamp, the shadow swells around the puppet's middle (its rod) and drifts a little
  // away from the light. Full projective drift would throw edge puppets off the screen.
  const lampX = r.x + r.w * 0.5;
  const lampY = r.y - r.h * 0.1;
  const size = rig.height * r.h * scale;
  const [ax0, ay0] = rig.rodAnchor;
  const cx = r.x + pose.x * r.w;
  const cy = r.y + pose.y * r.h + ay0 * rig.height * r.h;
  const drift = 1 + (scale - 1) * 0.2;
  const mx = lampX + (cx - lampX) * drift - lamp.dx * unit * scale;
  const my = lampY + (cy - lampY) * drift - lamp.dy * unit * scale;
  const px = mx - ax0 * size * pose.flipX;
  const py = my - ay0 * size;

  ctx.save();
  const base = ctx.getTransform();
  ctx.globalAlpha = Math.max(0, Math.min(1, pose.opacity * shadow.opacity));
  const blur = shadow.blur * unit + 0.7 * unit;
  ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.fillStyle = COLOR.shadow;
  ctx.strokeStyle = COLOR.shadow;

  ctx.translate(px, py);
  ctx.scale(size * pose.flipX, size);
  const [ax, ay] = rig.rodAnchor;
  ctx.translate(ax, ay);
  ctx.rotate(pose.tilt * RAD);
  ctx.translate(-ax, -ay);

  const rodEnds: Pt[] = [apply(ctx.getTransform(), rig.rodAnchor)];
  const drawArm = (arm: ArmRig, shoulderDeg: number, elbowDeg: number) => {
    const paths = armPath(arm);
    ctx.save();
    ctx.translate(arm.shoulder[0], arm.shoulder[1]);
    ctx.rotate(-shoulderDeg * RAD);
    ctx.fill(paths.upper);
    ctx.translate(arm.elbow[0], arm.elbow[1]);
    ctx.rotate(-elbowDeg * RAD);
    ctx.fill(paths.lower);
    rodEnds.push(apply(ctx.getTransform(), arm.hand));
    ctx.restore();
  };

  if (rig.arms) drawArm(rig.arms.back, pose.shoulderBack, pose.elbowBack);
  ctx.fill(bodyPath(rig), 'evenodd');
  if (rig.arms) drawArm(rig.arms.front, pose.shoulderFront, pose.elbowFront);

  // Rods: thin sticks from the hands and body down toward the dalang below the screen.
  ctx.setTransform(base);
  ctx.lineWidth = 1.6 * unit;
  ctx.lineCap = 'round';
  const bottom = r.y + r.h * 1.05;
  const center = r.x + r.w * 0.5;
  for (const [hx, hy] of rodEnds) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + (center - hx) * 0.12, bottom);
    ctx.stroke();
  }
  ctx.restore();
}
