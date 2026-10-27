// Offline support. Hashed build assets are cache-first (their names change when they change).
// Pages and plays are network-first, so returning visitors get updates and the cache is only
// a fallback for when the internet is off.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `bayang-eyang-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bayang-eyang-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const store = (req, res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};
const fromCache = (req) => caches.match(req, { ignoreSearch: req.mode === 'navigate', ignoreVary: true });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(fromCache(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => store(req, res))
      .catch(() => fromCache(req).then((hit) => hit || Response.error())),
  );
});
