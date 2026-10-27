import { describe, expect, test } from 'vitest';
import { getRig } from '../../src/rigs';
import { PUPPET_KEYS } from '../../src/script/vocabulary';

const PATH = /^[Mm][\d\s.,\-MmLlCcQqZzHhVvAaSsTt]+$/;

describe('rigs', () => {
  test.each(PUPPET_KEYS)('%s has valid paths', (key) => {
    const rig = getRig(key);
    expect(rig.key).toBe(key);
    expect(rig.body).toMatch(PATH);
    expect(rig.perforation).toMatch(PATH);
    if (rig.arms) {
      for (const arm of [rig.arms.back, rig.arms.front]) {
        expect(arm.upper).toMatch(PATH);
        expect(arm.lower).toMatch(PATH);
      }
    }
  });

  test('only the gunungan has no arms', () => {
    for (const key of PUPPET_KEYS) {
      expect(getRig(key).arms === null).toBe(key === 'gunungan');
    }
  });

  test('heights follow puppet type', () => {
    expect(getRig('raksasa').height).toBe(0.68);
    expect(getRig('gunungan').height).toBe(0.75);
    expect(getRig('eyang-putri').height).toBe(0.5);
  });
});
