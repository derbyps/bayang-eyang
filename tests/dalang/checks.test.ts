import { describe, expect, test } from 'vitest';
import { storyChecks, styleNotes, variety } from '../../src/dalang/checks';
import { direct } from '../../src/dalang/director';
import { nenekSari } from '../../src/dalang/sample';
import type { Storyboard } from '../../src/dalang/storyboard';

const check = (sb: Storyboard) => storyChecks(sb, direct(sb, 1));

describe('storyChecks', () => {
  test('the sample has no problems', () => {
    expect(check(nenekSari())).toEqual([]);
  });

  test('asks for a gara-gara when there is none', () => {
    const sb = nenekSari();
    sb.scenes[2].kind = 'jejer';
    expect(check(sb).join('\n')).toMatch(/gara-gara/);
  });

  test('asks for the hero in at least two scenes', () => {
    const sb = nenekSari();
    for (const s of sb.scenes.slice(1)) s.moves = s.moves.filter((m) => m.who !== 'nenek' && m.target !== 'nenek');
    sb.scenes[1].moves.push({ who: 'flood', do: 'laugh' }, { who: 'flood', do: 'dance' });
    expect(check(sb).join('\n')).toMatch(/hero/);
  });

  test('a scene with two real moves is fine, even if the model also wrote director moves', () => {
    const sb = nenekSari();
    sb.scenes[3].moves = [
      { who: 'nenek', do: 'bow' },
      { who: 'semar', do: 'laugh' },
      { who: 'nenek', do: 'exit' },
    ];
    expect(check(sb).join('\n')).not.toMatch(/Fifty Years On/);
  });

  test('names a scene left with fewer than two moves', () => {
    const sb = nenekSari();
    sb.scenes[3].moves = [
      { who: 'nenek', do: 'dance' },
      { who: 'ghost', do: 'laugh' },
      { who: 'nenek', do: 'teleport' },
    ];
    expect(check(sb).join('\n')).toMatch(/Fifty Years On/);
  });

  test('says how long a short play lasts', () => {
    const sb = nenekSari();
    const msg = storyChecks(sb, { ...direct(sb, 1), duration: 41.4 }).join('\n');
    expect(msg).toMatch(/lasts 41 s/);
  });

  test('names an action used for more than 40% of moves', () => {
    const sb = nenekSari();
    for (const s of sb.scenes) s.moves = s.moves.map((m, i) => (i % 3 === 2 ? m : { who: m.who, do: 'speak', style: i % 2 ? 'calm' : 'animated', line: 'Hello there.' }));
    expect(check(sb).join('\n')).toMatch(/"speak"/);
  });

  test('explains unknown actions with the valid choices', () => {
    const sb = nenekSari();
    sb.scenes[0].moves.splice(1, 0, { who: 'nenek', do: 'teleport' });
    const msg = check(sb).join('\n');
    expect(msg).toMatch(/teleport/);
    expect(msg).toMatch(/attack/);
  });

  test('an unknown style alone is not a problem: the director plays the default style', () => {
    const sb = nenekSari();
    sb.scenes[0].moves.splice(1, 0, { who: 'nenek', do: 'laugh', style: 'moonwalk' });
    expect(check(sb)).toEqual([]);
  });
});

describe('styleNotes', () => {
  test('explains an unknown style with the valid styles', () => {
    const sb = nenekSari();
    sb.scenes[0].moves.splice(1, 0, { who: 'nenek', do: 'laugh', style: 'moonwalk' });
    expect(styleNotes(sb, direct(sb, 1)).join('\n')).toMatch(/laugh\/moonwalk; laugh styles are giggle, belly/);
  });
});

test('variety counts story scenes, distinct moves and puppets', () => {
  const v = variety(direct(nenekSari(), 1).lakon);
  expect(v.scenes).toBe(4);
  expect(v.actionStyles).toBeGreaterThan(15);
  expect(v.puppets).toBe(5);
});
