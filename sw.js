const CACHE = 'bananas-v22';
const ASSETS = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/config.js',
  'js/art.js',
  'js/engine.js',
  'assets/banana.webp',
  'assets/banana_peeled.webp',
  'assets/broccoli.webp',
  'assets/baby_catch.png',
  'assets/baby_swat.png',
  'assets/baby_eat.png',
  'assets/baby_yuck.png',
  'assets/baby_neutral.png',
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
