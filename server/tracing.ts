// Tracing seam. Task 9 fills this with Sentry; without a DSN it is a no-op.
export interface Tracer {
  run<T>(name: string, attrs: Record<string, string | number>, fn: () => Promise<T>): Promise<T>;
  issue(message: string, tags: Record<string, string>): void;
}

export function createTracer(): Tracer {
  return {
    run: (_name, _attrs, fn) => fn(),
    issue: () => undefined,
  };
}
