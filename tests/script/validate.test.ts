import { describe, expect, test } from 'vitest';
import { validateLakon, type RuleId } from '../../src/script/validate';
import { base } from '../helpers/fixtures';

function rules(input: unknown): RuleId[] {
  const r = validateLakon(input);
  return r.ok ? [] : r.errors.map((e) => e.rule);
}

describe('validateLakon', () => {
  test('accepts the base fixture', () => {
    expect(validateLakon(base()).ok).toBe(true);
  });

  test('schema failure reports one schema error with the path', () => {
    const l = base();
    (l as Record<string, unknown>).version = 2;
    const r = validateLakon(l);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].rule).toBe('schema');
      expect(r.errors[0].message).toContain('version');
    }
  });

  test('order: decreasing t', () => {
    expect(rules(base([{ t: 0.5, actor: 'petruk', do: 'laugh' }]))).toContain('order');
  });

  test('cast: unknown actor', () => {
    expect(rules(base([{ t: 2, actor: 'ghost', do: 'laugh' }]))).toContain('cast');
  });

  test('cast: target is the actor itself', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'point', target: 'petruk' }]))).toContain('cast');
  });

  test('style: unknown style for the action', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'attack', style: 'moonwalk', target: 'eyang' }]))).toContain(
      'style',
    );
  });

  test('style: missing style uses the default', () => {
    expect(validateLakon(base([{ t: 2, actor: 'petruk', do: 'laugh' }])).ok).toBe(true);
  });

  test('needs: attack without target', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'attack' }]))).toContain('needs');
  });

  test('needs: speak without line', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'speak' }]))).toContain('needs');
  });

  test('gunungan: semar-like actor using a gunungan action', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'gunungan-open' }]))).toContain('gunungan');
  });

  test('gunungan: gunungan laughing', () => {
    expect(
      rules(
        base([
          { t: 2, actor: 'gunungan', do: 'enter', from: 'left' },
          { t: 3, actor: 'gunungan', do: 'laugh' },
        ]),
      ),
    ).toContain('gunungan');
  });

  test('on-stage: acting before entering', () => {
    const l = base();
    l.beats = [{ t: 0, actor: 'eyang', do: 'laugh' }];
    expect(rules(l)).toContain('on-stage');
  });

  test('on-stage: entering twice', () => {
    expect(rules(base([{ t: 2, actor: 'eyang', do: 'enter', from: 'left' }]))).toContain('on-stage');
  });

  test('on-stage: acting after being flung', () => {
    expect(
      rules(
        base([
          { t: 2, actor: 'eyang', do: 'fling', target: 'petruk' },
          { t: 4, actor: 'petruk', do: 'laugh' },
        ]),
      ),
    ).toContain('on-stage');
  });

  test('on-stage: a beat after linger', () => {
    expect(
      rules(
        base([
          { t: 2, actor: 'eyang', do: 'linger' },
          { t: 5, actor: 'eyang', do: 'bow' },
        ]),
      ),
    ).toContain('on-stage');
  });

  test('repeat: same do/style twice in a row, with the exact message', () => {
    const r = validateLakon(
      base([
        { t: 2, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
        { t: 3, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const e = r.errors.find((x) => x.rule === 'repeat');
      expect(e?.message).toBe(
        'beat 3: "petruk" uses attack/kick twice in a row — choose a different style or action',
      );
    }
  });

  test('repeat: allowed with another beat in between', () => {
    expect(
      validateLakon(
        base([
          { t: 2, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
          { t: 3, actor: 'petruk', do: 'laugh' },
          { t: 4, actor: 'petruk', do: 'attack', style: 'kick', target: 'eyang' },
        ]),
      ).ok,
    ).toBe(true);
  });

  test('mods: on a non-combat action', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'laugh', mods: ['feint'] }]))).toContain('mods');
  });

  test('mods: high and low together', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'strike', target: 'eyang', mods: ['high', 'low'] }]))).toContain(
      'mods',
    );
  });

  test('mods: duplicates', () => {
    expect(rules(base([{ t: 2, actor: 'petruk', do: 'strike', target: 'eyang', mods: ['miss', 'miss'] }]))).toContain(
      'mods',
    );
  });

  test('range: t above 300', () => {
    expect(rules(base([{ t: 301, actor: 'petruk', do: 'laugh' }]))).toContain('range');
  });

  test('range: first scene must start at 0', () => {
    const l = base();
    l.scenes[0].start = 2;
    expect(rules(l)).toContain('range');
  });
});
