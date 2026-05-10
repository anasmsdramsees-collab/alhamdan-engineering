// حولك لوجيستك — Service Worker
const CACHE = 'hawlak-v1';
const ASSETS = [
  '/alhamdan-engineering/',
  '/alhamdan-engineering/index.html',
  '/alhamdan-engineering/hawlak-logo.jpg',
  '/alhamdan-engineering/hawlak-icon-192.png',
  '/alhamdan-engineering/hawlak-icon-512.png',
  '/alhamdan-engineering/logo-naqel.png',
  '/alhamdan-engineering/logo-dhl.png',
  '/alhamdan-engineering/logo-ajex.png',
  '/alhamdan-engineering/logo-aramex.png',
  '/alhamdan-engineering/logo-aymakan.png',
  '/alhamdan-engineering/logo-noon.png',
  '/alhamdan-engineering/logo-hungerstation.png',
  '/alhamdan-engineering/logo-keeta.png',
  '/alhamdan-engineering/logo-chefz.png',
  '/alhamdan-engineering/logo-ninja.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
