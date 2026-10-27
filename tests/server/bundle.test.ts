import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findSecrets } from '../../scripts/find-secrets';

test('finds a planted DigitalOcean token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  writeFileSync(join(dir, 'app.js'), 'const k = "dop_v1_abc123def456";');
  writeFileSync(join(dir, 'other.js'), 'process.env.DO_INFERENCE_KEY');
  expect(findSecrets(dir).map((f) => f.file).sort()).toEqual(['app.js', 'other.js']);
});

test.skipIf(!existsSync('dist'))('the built site contains no model key', () => {
  expect(findSecrets('dist')).toEqual([]);
});
