// Scans built files for anything that looks like the model key leaking into the client bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PATTERNS = [/dop_v1_[A-Za-z0-9]+/, /DO_INFERENCE_KEY/];

export function findSecrets(dir: string): { file: string; pattern: string }[] {
  const hits: { file: string; pattern: string }[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const text = readFileSync(p, 'latin1');
        for (const re of PATTERNS) if (re.test(text)) hits.push({ file: relative(dir, p), pattern: re.source });
      }
    }
  };
  walk(dir);
  return hits;
}
