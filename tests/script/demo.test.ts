import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compile } from '../../src/choreo/compile';
import { validateLakon } from '../../src/script/validate';
import { coverage } from './coverage';

const raw = JSON.parse(readFileSync('public/lakon/demo-eyang-putri.json', 'utf8'));

describe('Eyang Putri demo', () => {
  const result = validateLakon(raw);

  test('validates', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  test('uses all 22 actions', () => {
    if (!result.ok) throw new Error('invalid');
    expect(coverage(result.lakon).actions.size).toBe(22);
  });

  test('has the five wayang scenes in order', () => {
    if (!result.ok) throw new Error('invalid');
    expect(result.lakon.scenes.map((s) => s.kind)).toEqual(['gunungan', 'jejer', 'perang', 'gara-gara', 'tancep-kayon']);
  });

  test('runs about a minute', () => {
    if (!result.ok) throw new Error('invalid');
    const d = compile(result.lakon).duration;
    expect(d).toBeGreaterThanOrEqual(55);
    expect(d).toBeLessThanOrEqual(75);
  });
});
