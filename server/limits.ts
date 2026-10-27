// Keeps the hosted dalang from being drained: per-visitor plays per hour, and a daily spend cap.

export function createRateLimiter(opts: { limit: number; windowMs: number; now: () => number }) {
  const hits = new Map<string, number[]>();
  return {
    take(id: string): { ok: true } | { ok: false; retryAfterMin: number } {
      const t = opts.now();
      const recent = (hits.get(id) ?? []).filter((h) => t - h < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(id, recent);
        const waitMs = opts.windowMs - (t - recent[0]);
        return { ok: false, retryAfterMin: Math.max(1, Math.ceil(waitMs / 60_000)) };
      }
      recent.push(t);
      hits.set(id, recent);
      return { ok: true };
    },
  };
}

const utcDay = (ms: number) => Math.floor(ms / 86_400_000);

export function createBudget(opts: { dailyUsd: number; now: () => number }) {
  let day = utcDay(opts.now());
  let spent = 0;
  const roll = () => {
    const today = utcDay(opts.now());
    if (today !== day) {
      day = today;
      spent = 0;
    }
  };
  return {
    canSpend(): boolean {
      roll();
      return spent < opts.dailyUsd;
    },
    record(usd: number): void {
      roll();
      spent += usd;
    },
    resetsInMin(): number {
      const t = opts.now();
      return Math.ceil(((utcDay(t) + 1) * 86_400_000 - t) / 60_000);
    },
  };
}

/** USD per million tokens. Confirmed against the account in the deploy task. */
const PRICES: Record<string, { input: number; output: number }> = {
  'gemma-4-31B-it': { input: 0.18, output: 0.5 },
};

export function costOf(model: string, usage: { input: number; output: number }): number {
  const p = PRICES[model];
  return p ? (usage.input * p.input + usage.output * p.output) / 1e6 : 0;
}
