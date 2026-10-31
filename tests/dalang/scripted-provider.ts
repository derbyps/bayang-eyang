import type { Provider } from '../../src/dalang/pipeline';

export type Reply = string | Error | 'hang';

/** A provider that answers from a queue and records every call. */
export function scripted(replies: Reply[]) {
  const calls: { user: string; temperature: number }[] = [];
  const provider: Provider = {
    async chat(req) {
      calls.push({ user: req.user, temperature: req.temperature });
      const reply = replies.shift();
      if (reply === undefined) throw new Error('script exhausted');
      if (reply instanceof Error) throw reply;
      if (reply === 'hang') {
        return new Promise((_, reject) => {
          const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (req.signal?.aborted) fail();
          req.signal?.addEventListener('abort', fail);
        });
      }
      return { text: reply, usage: { input: 100, output: 50 }, model: 'scripted' };
    },
  };
  return { provider, calls };
}
