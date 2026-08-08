const CACHE_NAME = 'family-care-hub-v2';

// Relative URLs resolve against this script's own URL, so these land under
// /family-care-hub/ on GitHub Pages and under / when served from the root.
// Same-origin only: addAll is atomic, and one failed cross-origin fetch
// aborts the whole install, which is what kept v1 from ever activating.
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        // Cache same-origin hashed build assets as they are requested, so the
        // app shell keeps working offline after the first visit.
        if (networkResponse.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
