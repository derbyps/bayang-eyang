export interface Clock {
  play(): void;
  pause(): void;
  seek(t: number): void;
  setRate(r: number): void;
  /** Advances by the wall time since the last tick (capped) and returns t in seconds. */
  tick(): number;
  readonly playing: boolean;
  readonly rate: number;
}

export function createClock(now: () => number, opts: { maxStep?: number } = {}): Clock {
  const maxStep = opts.maxStep ?? 0.1;
  let t = 0;
  let rate = 1;
  let playing = false;
  let last = now();

  return {
    play() {
      playing = true;
      last = now();
    },
    pause() {
      playing = false;
    },
    seek(to: number) {
      t = Math.max(0, to);
      last = now();
    },
    setRate(r: number) {
      rate = r;
    },
    tick() {
      const current = now();
      if (playing) t += Math.min(maxStep, (current - last) / 1000) * rate;
      last = current;
      return t;
    },
    get playing() {
      return playing;
    },
    get rate() {
      return rate;
    },
  };
}
