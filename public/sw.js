const SHELL_CACHE = 'shell-v1';
const DATA_CACHE = 'data-v1';
const ASSETS_CACHE = 'assets-v1';
const KNOWN_CACHES = [SHELL_CACHE, DATA_CACHE, ASSETS_CACHE];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML) — network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          caches.open(SHELL_CACHE).then((c) => c.put(event.request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Data JSON files — network-first
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
          caches.open(DATA_CACHE).then((c) => c.put(event.request, response.clone())).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Hashed assets — cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(ASSETS_CACHE).then((c) => c.put(event.request, response.clone())).catch(() => {});
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — no respondWith, browser handles normally
});
