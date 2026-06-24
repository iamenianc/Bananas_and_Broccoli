/* ============================================================
   TESTING MODE — caching DISABLED.
   ------------------------------------------------------------
   While the game is in testing we want every refresh to pull
   the latest files straight from the server. This worker keeps
   no cache: it serves everything from the network, wipes any
   caches a previous version created, and unregisters itself so
   devices that already installed the old caching worker get
   cleaned up. Re-enable real offline caching after testing.
   ============================================================ */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));  // drop all old caches
    await self.clients.claim();
    await self.registration.unregister();                // remove this worker
  })());
});

// Network-only: never serve from cache.
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
