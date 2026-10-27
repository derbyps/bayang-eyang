import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compile } from '../../src/choreo/compile';
import { isActionBeat } from '../../src/script/schema';
import { validateLakon } from '../../src/script/validate';
import { coverage } from './coverage';

const raw = JSON.parse(readFileSync('public/lakon/showcase.json', 'utf8'));
const result = validateLakon(raw);
const lakon = () => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors.slice(0, 5)));
  return result.lakon;
};

describe('sabetan gallery showcase', () => {
  test('validates', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  test('uses every style and every modifier', () => {
    const c = coverage(lakon());
    expect(c.actions.size).toBe(22);
    expect(c.styles.size).toBe(51);
    expect(c.mods.size).toBe(5);
  });

  test('shows one sweep in each of the four temperaments on the Petruk puppet', () => {
    const l = lakon();
    const petruks = l.cast.filter((c) => c.puppet === 'petruk' && c.id.startsWith('as-'));
    expect(petruks.map((c) => c.type).sort()).toEqual(['gagah', 'halus', 'punakawan', 'raksasa']);
    for (const p of petruks) {
      expect(l.beats.some((b) => isActionBeat(b) && b.actor === p.id && b.do === 'attack' && b.style === 'sweep')).toBe(true);
    }
  });

  test('Petruk kicks twice with a different beat in between', () => {
    const kicks = lakon().beats.flatMap((b, i) =>
      isActionBeat(b) && b.actor === 'petruk' && b.do === 'attack' && b.style === 'kick' && !b.mods ? [i] : [],
    );
    expect(kicks.length).toBeGreaterThanOrEqual(2);
  });

  test('fits in four minutes', () => {
    expect(compile(lakon()).duration).toBeLessThanOrEqual(240);
  });
});
