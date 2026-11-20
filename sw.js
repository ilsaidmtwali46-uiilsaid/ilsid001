const CACHE = 'grocery-v5-20241121';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.json',
  'icon-192.png', 'icon-512.png',
  'globals.js', 'db.js', 'license.js', 'setup.js', 'parties.js',
  'suppliers.js', 'customers.js', 'purchases.js', 'inventory.js',
  'stocktake.js', 'daily.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => c.add(f)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
