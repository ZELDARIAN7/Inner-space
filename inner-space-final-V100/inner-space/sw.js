const VERSION = 'inner-space-v100-2';
const asset = p => new URL(p, self.registration.scope).toString();
const SHELL = [
  asset('./'),
  asset('inner-space.html'),
  asset('manifest.webmanifest'),
  asset('icons/icon-192.png'),
  asset('icons/icon-512.png'),
  asset('icons/icon-maskable-512.png')
];
const OFFLINE_APP = asset('inner-space.html');

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('inner-space-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(VERSION);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match(OFFLINE_APP));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
