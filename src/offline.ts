const CACHE = 'bayang-eyang-v1';

/**
 * Registers the service worker and caches everything this first visit loaded
 * (the page, scripts, styles, fonts and the play), so the next visit works offline.
 */
export function enableOffline(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return Promise.resolve();
  return navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready)
    .then(async () => {
      const urls = new Set<string>([location.pathname]);
      for (const e of performance.getEntriesByType('resource')) {
        const u = new URL(e.name);
        if (u.origin === location.origin) urls.add(u.pathname + u.search);
      }
      const cache = await caches.open(CACHE);
      await cache.addAll([...urls]);
    })
    .catch(() => undefined);
}
