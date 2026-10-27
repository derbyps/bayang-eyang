declare const __BUILD_ID__: string;

const CACHE = `bayang-eyang-${__BUILD_ID__}`;
const PLAYS = ['demo-eyang-putri', 'showcase'];

/**
 * Registers the service worker and caches what this first visit loaded (page, scripts,
 * styles, fonts) plus the bundled plays, so the next visit works with the internet off.
 */
export async function enableOffline(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`);
    await navigator.serviceWorker.ready;
    const urls = new Set<string>([location.pathname, ...PLAYS.map((p) => `${import.meta.env.BASE_URL}lakon/${p}.json`)]);
    for (const e of performance.getEntriesByType('resource')) {
      const u = new URL(e.name);
      if (u.origin === location.origin && !u.pathname.endsWith('sw.js')) urls.add(u.pathname + u.search);
    }
    const cache = await caches.open(CACHE);
    // One by one: a single missing file (say, a mistyped play) must not cancel the rest.
    await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
  } catch {
    // Offline support is a bonus; the play still runs online.
  }
}
