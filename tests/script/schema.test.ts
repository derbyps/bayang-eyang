import { describe, expect, test } from 'vitest';
import { LakonSchema } from '../../src/script/schema';

const minimal = () => ({
  version: 1,
  title: 'Test',
  seed: 1,
  cast: [{ id: 'eyang', puppet: 'eyang-putri', name: 'Eyang Putri', type: 'halus' }],
  scenes: [{ id: 's1', kind: 'jejer', title: 'Jejer', start: 0 }],
  beats: [{ t: 0, actor: 'eyang', do: 'enter', from: 'left' }] as Record<string, unknown>[],
});

describe('LakonSchema', () => {
  test('parses a minimal lakon', () => {
    expect(LakonSchema.safeParse(minimal()).success).toBe(true);
  });

  test('rejects an unknown key on a beat', () => {
    const l = minimal();
    l.beats[0].wobble = true;
    expect(LakonSchema.safeParse(l).success).toBe(false);
  });

  test('rejects intensity above 1', () => {
    const l = minimal();
    l.beats[0].intensity = 1.5;
    expect(LakonSchema.safeParse(l).success).toBe(false);
  });

  test('rejects a beat that is both an action and a narration', () => {
    const l = minimal();
    l.beats[0].narrate = 'hello';
    expect(LakonSchema.safeParse(l).success).toBe(false);
  });
});
