import { expect, test } from 'vitest';
import { ndjsonParser } from '../../src/dalang/client';

test('reassembles events split across chunks, including a final line without a newline', () => {
  const seen: unknown[] = [];
  const feed = ndjsonParser((e) => seen.push(e));
  feed('{"type":"progress","sta');
  feed('ge":"casting"}\n{"type":"ca');
  feed('st","title":"T","cast":[]}\n{"type":"done"');
  feed('}', true);
  expect(seen).toEqual([
    { type: 'progress', stage: 'casting' },
    { type: 'cast', title: 'T', cast: [] },
    { type: 'done' },
  ]);
});

test('skips blank and malformed lines without throwing', () => {
  const seen: unknown[] = [];
  const feed = ndjsonParser((e) => seen.push(e));
  feed('\n{oops}\n{"type":"done"}\n', true);
  expect(seen).toEqual([{ type: 'done' }]);
});
