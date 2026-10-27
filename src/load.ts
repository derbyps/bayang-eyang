import { compile, type Timeline } from './choreo/compile';
import { validateLakon, type ValidationError } from './script/validate';

export type LoadResult = { ok: true; tl: Timeline } | { ok: false; errors: ValidationError[] | string };

export const DEFAULT_LAKON = 'demo-eyang-putri';
const SAFE_NAME = /^[a-z0-9-]+$/;

export async function loadLakon(name: string, opts: { reducedMotion: boolean }): Promise<LoadResult> {
  if (!SAFE_NAME.test(name)) return { ok: false, errors: `"${name}" is not a valid play name` };
  let data: unknown;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}lakon/${name}.json`);
    if (!res.ok) return { ok: false, errors: `no play called "${name}" (HTTP ${res.status})` };
    data = await res.json();
  } catch (e) {
    return { ok: false, errors: `could not read "${name}": ${(e as Error).message}` };
  }
  const v = validateLakon(data);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ok: true, tl: compile(v.lakon, opts) };
}
