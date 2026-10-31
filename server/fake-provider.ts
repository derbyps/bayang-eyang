// A stand-in model for tests, demos and the browser test suite: answers with the sample play.
import type { Provider } from '../src/dalang/pipeline';
import { SAMPLE_CASTING, SAMPLE_SCENES } from '../src/dalang/sample';

export function createFakeProvider(opts: { delayMs?: number } = {}): Provider {
  const delayMs = opts.delayMs ?? 0;
  return {
    info: { provider: 'fake', model: 'fake' },
    async chat(req) {
      if (delayMs) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          req.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      }
      const body = req.user.includes('Cast the play') ? SAMPLE_CASTING : SAMPLE_SCENES;
      return { text: JSON.stringify(body), usage: { input: 0, output: 0 }, model: 'fake' };
    },
  };
}
