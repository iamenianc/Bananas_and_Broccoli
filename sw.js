const CACHE = 'bananas-v11';
const ASSETS = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/config.js',
  'js/art.js',
  'js/engine.js',
  'assets/banana.png',
  'assets/banana_peeled.png',
  'assets/broccoli.png',
  'assets/baby_catch.svg',
  'assets/baby_swat.svg',
  'assets/baby_eat.svg',
  'assets/baby_yuck.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
