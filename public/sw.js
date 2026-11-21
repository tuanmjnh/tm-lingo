// Legacy Vite PWA cleanup service worker (production sw.js path).
// Clears stale Workbox caches from before the Next.js migration, unregisters itself, and reloads active tabs.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        // ignore cache cleanup errors
      }
      try {
        await self.registration.unregister();
      } catch {
        // ignore unregister errors
      }
      try {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          client.navigate(client.url);
        }
      } catch {
        // ignore navigation errors
      }
    })()
  );
});
