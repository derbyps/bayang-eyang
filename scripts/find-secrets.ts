// Scans built files for anything that looks like the model key leaking into the client bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const NAMES = ['CF_API_TOKEN'];

/** Files under dir that contain a secret's name or one of its actual values. */
export function findSecrets(dir: string, values: (string | undefined)[] = []): { file: string; pattern: string }[] {
  const needles = [...NAMES, ...values.filter((v): v is string => !!v)];
  const hits: { file: string; pattern: string }[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const text = readFileSync(p, 'latin1');
        const found = needles.find((n) => text.includes(n));
        if (found) hits.push({ file: relative(dir, p), pattern: NAMES.includes(found) ? found : '(secret value)' });
      }
    }
  };
  walk(dir);
  return hits;
}
