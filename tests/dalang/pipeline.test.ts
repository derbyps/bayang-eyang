import { describe, expect, test } from 'vitest';
import { runDalang, type DalangEvent } from '../../src/dalang/pipeline';
import { SAMPLE_CASTING, SAMPLE_SCENES, SAMPLE_STORY } from '../../src/dalang/sample';
import { validateLakon } from '../../src/script/validate';
import { scripted, type Reply } from './scripted-provider';
import demo from '../../public/lakon/demo-eyang-putri.json';
import type { Lakon } from '../../src/script/schema';

const casting = JSON.stringify(SAMPLE_CASTING);
const scenes = JSON.stringify(SAMPLE_SCENES);
const badScenes = JSON.stringify({
  scenes: SAMPLE_SCENES.scenes.map((s) => ({ ...s, kind: 'jejer' })),
});
const fallback = demo as Lakon;

async function run(replies: Reply[], signal?: AbortSignal) {
  const s = scripted(replies);
  const events: DalangEvent[] = [];
  const result = await runDalang(SAMPLE_STORY, s.provider, { seed: 5, fallback, onEvent: (e) => events.push(e), signal });
  return { result, events, calls: s.calls };
}

describe('runDalang', () => {
  test('success path emits events in order and a valid play', async () => {
    const { result, events } = await run([casting, scenes]);
    expect(events.map((e) => (e.type === 'progress' ? `progress:${e.stage}` : e.type))).toEqual([
      'progress:casting',
      'cast',
      'progress:scenes',
      'progress:checking',
      'done',
    ]);
    expect(result.rounds).toBe(0);
    expect(result.fallback).toBe(false);
    expect(validateLakon(result.lakon).ok).toBe(true);
    const cast = events.find((e) => e.type === 'cast');
    expect(cast && cast.type === 'cast' && cast.cast.map((c) => c.name)).toContain('The Flood');
  });

  test('a repaired storyboard counts one round', async () => {
    const { result, events, calls } = await run([casting, badScenes, scenes]);
    expect(calls[2].user).toContain('<story>');
    expect(calls[2].user).toContain('"id":"flood"');
    expect(events.filter((e) => e.type === 'repair')).toHaveLength(1);
    expect(result.rounds).toBe(1);
    expect(result.fallback).toBe(false);
  });

  test('unknown styles alone are accepted without a repair round', async () => {
    const styled = JSON.stringify({
      scenes: SAMPLE_SCENES.scenes.map((sc, i) => (i ? sc : { ...sc, moves: sc.moves.map((m, j) => (j ? m : { ...m, style: 'moonwalk' })) })),
    });
    const { result, calls } = await run([casting, styled]);
    expect(result.rounds).toBe(0);
    expect(result.fallback).toBe(false);
    expect(calls).toHaveLength(2);
  });

  test('a repair round also lists unknown styles alongside real problems', async () => {
    const both = JSON.stringify({
      scenes: SAMPLE_SCENES.scenes.map((sc, i) => ({
        ...sc,
        kind: 'jejer',
        moves: i ? sc.moves : sc.moves.map((m, j) => (j ? m : { ...m, style: 'moonwalk' })),
      })),
    });
    const { calls } = await run([casting, both, scenes]);
    expect(calls[2].user).toMatch(/gara-gara/);
    expect(calls[2].user).toMatch(/moonwalk/);
  });

  test('non-JSON model output repairs then falls back', async () => {
    const { result, events } = await run([casting, 'Sure! Here is a play.', 'Oops.', 'Still prose.']);
    expect(events.filter((e) => e.type === 'repair')).toHaveLength(2);
    expect(result.fallback).toBe(true);
    expect(result.lakon).toBe(fallback);
  });

  test('a provider error falls back', async () => {
    const { result } = await run([new Error('502 from upstream')]);
    expect(result.fallback).toBe(true);
    expect(result.lakon).toBe(fallback);
  });

  test('aborting rejects and emits no done event', async () => {
    const ctrl = new AbortController();
    const events: DalangEvent[] = [];
    const s = scripted([casting, 'hang']);
    const p = runDalang(SAMPLE_STORY, s.provider, { seed: 5, fallback, onEvent: (e) => events.push(e), signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 10);
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  test('uses the planned temperatures', async () => {
    const { calls } = await run([casting, badScenes, scenes]);
    expect(calls.map((c) => c.temperature)).toEqual([0.8, 0.9, 0.4]);
  });

  test('a storyboard still broken after two repairs keeps its working moves', async () => {
    const broken = JSON.stringify({
      scenes: SAMPLE_SCENES.scenes.map((s, i) => (i === 0 ? { ...s, moves: [...s.moves, { who: 'nenek', do: 'teleport' }] } : s)),
    });
    const { result } = await run([casting, broken, broken, broken]);
    expect(result.fallback).toBe(false);
    expect(result.dropped).toBe(1);
    expect(validateLakon(result.lakon).ok).toBe(true);
  });
});
