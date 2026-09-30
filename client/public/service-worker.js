const CACHE_NAME = 'lmsgen-app-v3';
const BRAND_ASSETS = [
  '/branding/lmsgen-bimi.svg',
  '/branding/lmsgen-favicon.png',
  '/branding/lmsgen-app-192.png',
  '/branding/lmsgen-app-512.png',
  '/branding/lmsgen-app-maskable-512.png',
  '/branding/lmsgen-logo-dark.png',
  '/branding/lmsgen-logo-light.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(BRAND_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('lmsgen-app-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authentication, API responses and HTML must always stay network-fresh.
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) return;

  const cacheable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/branding/');
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || !response.ok || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
