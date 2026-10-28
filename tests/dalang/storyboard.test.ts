import { describe, expect, test } from 'vitest';
import { CastingSchema, ScenesSchema, STORY_ACTIONS, resolveActors } from '../../src/dalang/storyboard';
import { nenekSari } from '../../src/dalang/sample';

const role = (id: string, r: string, puppet = 'petruk') => ({
  id,
  name: id.toUpperCase(),
  puppet,
  type: 'punakawan',
  role: r,
  why: 'because',
});
const casting = (cast = [role('nenek', 'hero', 'eyang-putri'), role('flood', 'trouble', 'raksasa'), role('petruk', 'clown')]) => ({
  title: 'Nenek and the Flood',
  language: 'en',
  cast,
});
const move = { who: 'nenek', do: 'bow' };
const scene = (moves = 3, narration = 1) => ({
  kind: 'jejer',
  title: 'Home',
  narration: Array.from({ length: narration }, () => 'Once.'),
  moves: Array.from({ length: moves }, () => ({ ...move })),
});
const scenes = (n = 3, s = scene()) => ({ scenes: Array.from({ length: n }, () => s) });

describe('CastingSchema', () => {
  test('accepts a three-role cast with one hero', () => {
    expect(CastingSchema.safeParse(casting()).success).toBe(true);
  });
  test.each([
    ['no hero', [role('a', 'ally'), role('b', 'clown')]],
    ['two heroes', [role('a', 'hero'), role('b', 'hero')]],
    ['one role', [role('a', 'hero')]],
    ['seven roles', [role('h', 'hero'), ...'abcdef'.split('').map((c) => role(c, 'ally'))]],
    ['a gunungan', [role('a', 'hero'), role('b', 'ally', 'gunungan')]],
  ])('rejects %s', (_, cast) => {
    expect(CastingSchema.safeParse(casting(cast)).success).toBe(false);
  });
  test('drops unknown keys', () => {
    const extra = CastingSchema.safeParse({ ...casting(), scenes: [] });
    expect(extra.success).toBe(true);
    expect(extra.success && 'scenes' in extra.data).toBe(false);
  });
});

describe('ScenesSchema', () => {
  test('accepts three scenes of three moves', () => {
    expect(ScenesSchema.safeParse(scenes()).success).toBe(true);
  });
  test.each([
    ['two scenes', scenes(2)],
    ['ten scenes', scenes(10)],
    ['two moves', scenes(3, scene(2))],
    ['eleven moves', scenes(3, scene(11))],
    ['no narration', scenes(3, scene(3, 0))],
    ['four narration lines', scenes(3, scene(3, 4))],
  ])('rejects %s', (_, s) => {
    expect(ScenesSchema.safeParse(s).success).toBe(false);
  });
  test('shortens an over-long scene title at a word instead of failing', () => {
    const s = { ...scene(), title: "The Radio Maker's Morning Under the Mango Tree" };
    const parsed = ScenesSchema.safeParse(scenes(3, s));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.scenes[0].title).toBe("The Radio Maker's Morning Under…");
  });
  test('ignores keys it does not know instead of failing', () => {
    const s = { ...scene(), mood: 'sad' };
    s.moves = s.moves.map((m) => ({ ...m, emotion: 'joy' }));
    const parsed = ScenesSchema.safeParse({ ...scenes(3, s), title: 'x' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'emotion' in parsed.data.scenes[0].moves[0]).toBe(false);
  });
  test('reads "to" as the target', () => {
    const s = scene();
    s.moves[0] = { who: 'petruk', do: 'attack', to: 'nenek' } as unknown as typeof move;
    const parsed = ScenesSchema.safeParse(scenes(3, s));
    expect(parsed.success && parsed.data.scenes[0].moves[0].target).toBe('nenek');
  });
  test('treats empty line, target and mods as absent', () => {
    const s = scene();
    s.moves[0] = { ...move, line: '', target: '', mods: [] } as typeof move;
    const parsed = ScenesSchema.safeParse(scenes(3, s));
    expect(parsed.success).toBe(true);
    const m = parsed.success ? parsed.data.scenes[0].moves[0] : {};
    expect(['line', 'target', 'mods'].filter((k) => k in m)).toEqual([]);
  });
  test('rejects a line over 140 characters', () => {
    const s = scene();
    s.moves[0] = { ...move, do: 'speak', line: 'x'.repeat(141) } as typeof move;
    expect(ScenesSchema.safeParse(scenes(3, s)).success).toBe(false);
  });
});

test('STORY_ACTIONS leaves stage mechanics to the director', () => {
  expect(STORY_ACTIONS).toHaveLength(16);
  for (const a of ['enter', 'exit', 'linger', 'gunungan-open', 'gunungan-close', 'gunungan-storm']) {
    expect(STORY_ACTIONS).not.toContain(a);
  }
});

describe('resolveActors', () => {
  test('maps a puppet name used by one cast member, and a character name, to the cast id', () => {
    const sb = nenekSari();
    sb.scenes[0].moves = [
      { who: 'eyang-putri', do: 'bow' },
      { who: 'The Flood', do: 'attack', target: 'Nenek Sari' },
      { who: 'raksasa', do: 'laugh' },
    ];
    expect(resolveActors(sb).scenes[0].moves.map((m) => [m.who, m.target])).toEqual([
      ['nenek', undefined],
      ['flood', 'nenek'],
      ['flood', undefined],
    ]);
  });
  test('brings an uncast clown-servant into the cast', () => {
    const sb = nenekSari();
    sb.cast = sb.cast.filter((c) => c.id !== 'bagong');
    sb.scenes[0].moves = [{ who: 'bagong', do: 'laugh', target: 'nenek' }, { who: 'petruk', do: 'point', target: 'Bagong' }];
    const r = resolveActors(sb);
    expect(r.cast.find((c) => c.id === 'bagong')).toMatchObject({ puppet: 'bagong', role: 'clown', type: 'punakawan', name: 'Bagong' });
    expect(r.scenes[0].moves.map((m) => [m.who, m.target])).toEqual([['bagong', 'nenek'], ['petruk', 'bagong']]);
  });
  test('does not add a clown when the cast is full', () => {
    const sb = nenekSari();
    sb.cast = sb.cast.filter((c) => c.id !== 'bagong');
    sb.cast.push({ ...sb.cast[1], id: 'fever', name: 'The Fever' }, { ...sb.cast[1], id: 'debt', name: 'The Debt' });
    sb.scenes[0].moves = [{ who: 'bagong', do: 'laugh' }];
    expect(resolveActors(sb).cast).toHaveLength(6);
  });
  test('leaves unknown names and puppets shared by two cast members alone', () => {
    const sb = nenekSari();
    sb.cast.push({ ...sb.cast[1], id: 'fever', name: 'The Fever' });
    sb.scenes[0].moves = [{ who: 'raksasa', do: 'laugh' }, { who: 'gareng', do: 'dance' }];
    expect(resolveActors(sb).scenes[0].moves.map((m) => m.who)).toEqual(['raksasa', 'gareng']);
  });
});
