export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECT = 16 / 9;

/** The largest 16:9 rectangle centred in the viewport. */
export function fitStage(vw: number, vh: number): Rect {
  if (vw / vh > ASPECT) {
    const w = vh * ASPECT;
    return { x: (vw - w) / 2, y: 0, w, h: vh };
  }
  const h = vw / ASPECT;
  return { x: 0, y: (vh - h) / 2, w: vw, h };
}
