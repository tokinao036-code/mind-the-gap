// Mind the Gap offline support.
// App shell + course data: network-first (updates arrive), cached for offline. Audio and fonts: cache-first.
const V = 'v4';
const APP = 'mtg-app-' + V;
const AUDIO = 'mtg-audio';
const EXT = 'mtg-ext';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/audio.js', 'js/srs.js', 'js/check.js',
  'js/cards.js', 'js/exercises.js', 'js/lesson.js', 'js/screens.js',
  'data/course.json', 'data/glossary.json', 'data/audio.json', 'data/w1.json', 'data/w2.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('mtg-app-') && k !== APP) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/audio/')) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com|pinimg\.com/.test(url.host)) {
    e.respondWith(caches.open(EXT).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
