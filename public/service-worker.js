// Bump this whenever a precached file below changes. Those files are not
// content-addressed, so cache-first would otherwise serve the old copy
// forever; the activate handler deletes every cache not named here.
//
// v3 evicted caches holding a stale index.html from the cache-first era.
// v4 evicts the manifest.json that still pointed at CDN-hosted icons.
const CACHE_NAME = 'family-care-hub-v4';

// Relative URLs resolve against this script's own URL, so these land under
// /family-care-hub/ on GitHub Pages and under / when served from the root.
// Same-origin only: addAll is atomic, and one failed cross-origin fetch
// aborts the whole install, which is what kept v1 from ever activating.
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  // Take over without waiting for every tab to close. A worker shipped to fix
  // a broken cache is useless if the broken one keeps serving the page.
  self.skipWaiting();
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

const isSameOrigin = (request) =>
  new URL(request.url).origin === self.location.origin;

const putInCache = (request, response) => {
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first for the HTML shell. It names content-hashed assets, so a
  // cached copy from a previous deploy points at files that no longer exist --
  // the browser then gets the 404 page instead of JavaScript and refuses it on
  // MIME grounds, leaving a white screen. Falls back to cache when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) putInCache(event.request, networkResponse);
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first is safe for everything else: build assets are content-addressed,
  // so a given URL never changes meaning.
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && isSameOrigin(event.request)) {
          putInCache(event.request, networkResponse);
        }
        return networkResponse;
      });
    })
  );
});
