// TM-Lingo Service Worker: Offline Cache API Strategy + Web Push Notifications
const CACHE_SHELL = 'tm-lingo-shell-v1';
const CACHE_LESSON = 'tm-lingo-lesson-assets-v1';
const CACHE_STORY = 'tm-lingo-story-assets-v1';
const CACHE_RUNTIME = 'tm-lingo-runtime-media-v1';

const ACTIVE_CACHES = new Set([
  CACHE_SHELL,
  CACHE_LESSON,
  CACHE_STORY,
  CACHE_RUNTIME,
  'tm-lingo-tts-audio-v1',
]);

const SHELL_PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/icon.svg',
];

const NEVER_CACHE_PREFIXES = [
  '/api/v1/auth/',
  '/api/v1/admin/',
  '/api/v1/notifications/',
  '/_next/webpack-hmr',
];

const CACHEABLE_API_PREFIXES = [
  '/api/v1/lessons',
  '/api/v1/stories',
  '/api/v1/packages',
  '/api/v1/voices',
  '/api/v1/languages',
  '/api/v1/age-groups',
];

function isSafeCacheableUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.origin === self.location.origin) {
      for (const blocked of NEVER_CACHE_PREFIXES) {
        if (parsed.pathname.startsWith(blocked)) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function isSameOrigin(urlObj) {
  return urlObj.origin === self.location.origin;
}

function isCacheableApiPath(pathname) {
  return CACHEABLE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isMediaOrStaticAsset(request, urlObj) {
  const dest = request.destination;
  if (dest === 'image' || dest === 'audio' || dest === 'font') return true;
  if (
    isSameOrigin(urlObj) &&
    (urlObj.pathname.startsWith('/images/') ||
      urlObj.pathname.startsWith('/uploads/') ||
      urlObj.pathname.startsWith('/_next/static/'))
  ) {
    return true;
  }
  return false;
}

async function fetchAndStoreAsset(cache, rawUrl) {
  if (!isSafeCacheableUrl(rawUrl)) return false;
  const parsed = new URL(rawUrl, self.location.origin);
  const sameOrigin = isSameOrigin(parsed);

  try {
    const req = new Request(parsed.toString(), {
      method: 'GET',
      mode: sameOrigin ? 'same-origin' : 'cors',
      credentials: sameOrigin ? 'same-origin' : 'omit',
    });
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(parsed.toString(), res.clone());
      return true;
    }
  } catch {
    // Retry cross-origin media with no-cors so opaque illustrations remain usable offline
    if (!sameOrigin) {
      try {
        const opaqueReq = new Request(parsed.toString(), {
          method: 'GET',
          mode: 'no-cors',
          credentials: 'omit',
        });
        const opaqueRes = await fetch(opaqueReq);
        if (opaqueRes && opaqueRes.type === 'opaque') {
          await cache.put(parsed.toString(), opaqueRes.clone());
          return true;
        }
      } catch {
        return false;
      }
    }
  }
  return false;
}

async function precacheBucketAssets(bucket, urls) {
  const cacheName = bucket === 'story' ? CACHE_STORY : CACHE_LESSON;
  const uniqueUrls = Array.from(
    new Set(
      (Array.isArray(urls) ? urls : [])
        .filter((u) => isSafeCacheableUrl(u))
        .slice(0, 60)
        .map((u) => new URL(u, self.location.origin).toString())
    )
  );

  if (uniqueUrls.length === 0) {
    return { cachedCount: 0, totalCount: 0 };
  }

  const cache = await caches.open(cacheName);
  const desiredSet = new Set(uniqueUrls);

  // Prune stale assets from previous lesson/storybook so only the active/recent one occupies this bucket
  try {
    const existingKeys = await cache.keys();
    await Promise.all(
      existingKeys
        .filter((req) => !desiredSet.has(req.url))
        .map((req) => cache.delete(req))
    );
  } catch {
    // ignore cleanup errors
  }

  // Fetch missing or refresh API responses in small parallel batches
  let cachedCount = 0;
  const batchSize = 5;
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (url) => {
        const parsed = new URL(url);
        const isApi = isSameOrigin(parsed) && parsed.pathname.startsWith('/api/');
        if (!isApi) {
          const hit = await cache.match(url);
          if (hit) return true;
        }
        return fetchAndStoreAsset(cache, url);
      })
    );
    cachedCount += results.filter(Boolean).length;
  }

  return { cachedCount, totalCount: uniqueUrls.length };
}

async function trimRuntimeCache(maxEntries = 100) {
  try {
    const cache = await caches.open(CACHE_RUNTIME);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const excess = keys.length - maxEntries;
    await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
  } catch {
    // ignore
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) =>
        Promise.all(
          SHELL_PRECACHE_URLS.map((url) => fetchAndStoreAsset(cache, url))
        )
      )
      .catch(() => undefined)
      .finally(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => !ACTIVE_CACHES.has(name))
            .map((name) => caches.delete(name))
        );
      } catch {
        // ignore cache cleanup errors
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'PRECACHE_ASSETS') {
    const bucket = data.bucket === 'story' ? 'story' : 'lesson';
    const resourceId = typeof data.resourceId === 'string' ? data.resourceId : '';
    const urls = Array.isArray(data.urls) ? data.urls : [];

    event.waitUntil(
      precacheBucketAssets(bucket, urls)
        .then(async (stats) => {
          const payload = {
            type: 'PRECACHE_COMPLETE',
            bucket,
            resourceId,
            cachedCount: stats.cachedCount,
            totalCount: stats.totalCount,
            fullyCached: stats.totalCount > 0 && stats.cachedCount >= stats.totalCount,
          };
          if (event.source && 'postMessage' in event.source) {
            event.source.postMessage(payload);
            return;
          }
          const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });
          for (const client of clients) {
            client.postMessage(payload);
          }
        })
        .catch(() => undefined)
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  let urlObj;
  try {
    urlObj = new URL(request.url);
  } catch {
    return;
  }
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return;

  const sameOrigin = isSameOrigin(urlObj);

  // Never intercept auth, admin, notifications, or HMR requests
  if (sameOrigin) {
    for (const blocked of NEVER_CACHE_PREFIXES) {
      if (urlObj.pathname.startsWith(blocked)) return;
    }
  }

  // 1. Navigation requests: Network-first with cached app shell fallback
  if (request.mode === 'navigate' && sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && urlObj.pathname === '/') {
            const copy = response.clone();
            caches.open(CACHE_SHELL).then((c) => c.put('/', copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cachedPage =
            (await caches.match(request)) || (await caches.match('/'));
          return cachedPage || Response.error();
        })
    );
    return;
  }

  // 2. Learning Content API GETs: Network-first with Cache API fallback
  if (sameOrigin && isCacheableApiPath(urlObj.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_RUNTIME)
              .then((c) => c.put(request, copy))
              .then(() => trimRuntimeCache(100))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'Offline and no cached content available.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 3. Storybook / Lesson Images, Audio & Static Assets: Cache-first (with background update)
  if (isMediaOrStaticAsset(request, urlObj)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && (response.ok || response.type === 'opaque')) {
              const copy = response.clone();
              caches
                .open(CACHE_RUNTIME)
                .then((c) => c.put(request, copy))
                .then(() => trimRuntimeCache(100))
                .catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
  }
});

// ---------- Web Push & Notification Click Handlers ----------
self.addEventListener('push', (event) => {
  let payload = {
    title: 'TM-Lingo',
    body: 'Time for a gentle language story!',
    url: '/',
    tag: 'tm-lingo-notification',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
