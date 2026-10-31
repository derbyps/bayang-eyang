// Browser side of the dalang API: posts the story and reads the NDJSON event stream.
import type { DalangEvent } from './pipeline';
import type { StoryInput } from './storyboard';

export type ServerEvent = DalangEvent | { type: 'resting'; retryAfterMin: number } | { type: 'unavailable' };

/** Returns a feeder for text chunks; calls onEvent for each complete JSON line. */
export function ndjsonParser(onEvent: (e: ServerEvent) => void) {
  let buffer = '';
  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as ServerEvent);
    } catch {
      // A malformed line is skipped; the stream carries on.
    }
  };
  return (chunk: string, done = false) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(emit);
    if (done) {
      emit(buffer);
      buffer = '';
    }
  };
}

export async function requestPlay(story: StoryInput, onEvent: (e: ServerEvent) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api/dalang`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(story),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    onEvent({ type: 'unavailable' });
    return;
  }
  if (!res.ok || !res.body) {
    onEvent({ type: 'unavailable' });
    return;
  }
  const feed = ndjsonParser(onEvent);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    feed(decoder.decode(value, { stream: true }));
  }
  feed(decoder.decode(), true);
}
