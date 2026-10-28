import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findSecrets } from '../../scripts/find-secrets';

test('finds a planted Cloudflare token and the variable name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  writeFileSync(join(dir, 'app.js'), 'const k = "planted-token-0123456789";');
  writeFileSync(join(dir, 'other.js'), 'process.env.CF_API_TOKEN');
  writeFileSync(join(dir, 'clean.js'), 'const fine = 1;');
  expect(findSecrets(dir, ['planted-token-0123456789']).map((f) => f.file).sort()).toEqual(['app.js', 'other.js']);
});

test('ignores empty secret values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  writeFileSync(join(dir, 'app.js'), 'const fine = 1;');
  expect(findSecrets(dir, ['', undefined])).toEqual([]);
});

test.skipIf(!existsSync('dist'))('the built site contains no model key', () => {
  expect(findSecrets('dist', [process.env.CF_API_TOKEN])).toEqual([]);
});
