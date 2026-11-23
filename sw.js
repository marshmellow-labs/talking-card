// Offline support: pre-cache the app shell, then serve from cache while refreshing in the background
// (stale-while-revalidate), so a new version shows up on the next launch.
const CACHE = 'talking-cards-v4';
const FILES = ['./', './index.html', './css/app.css', './cards.json', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './assets/emoji.svg', './src/main.js', './src/detect.js', './src/camera.js', './src/games.js', './src/icons.js', './src/speech.js',
  './src/store.js', './src/ui/scan.js', './src/ui/flash.js', './src/ui/play.js', './src/ui/parent.js', './src/ui/chips.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  }));
});
