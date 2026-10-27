import { describe, expect, test } from 'vitest';
import { CastingSchema, ScenesSchema, STORY_ACTIONS } from '../../src/dalang/storyboard';

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
  test('rejects unknown keys', () => {
    expect(CastingSchema.safeParse({ ...casting(), extra: 1 }).success).toBe(false);
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
