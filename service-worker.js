const CACHE = 'bora-pro-role-live-v1';
const APP_SHELL = ['./', './index.html', './app.js', './style.css', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './termos.html', './privacidade.html', './comunidade.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bora-pro-role-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Nunca armazenar mapas, Supabase, imagens ou APIs externas.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      await caches.match(request) || await caches.match('./index.html')));
    return;
  }
  if (APP_SHELL.some(path => url.pathname.endsWith(path.replace('./','/')))) {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    }).catch(() => caches.match(request)));
  }
});
