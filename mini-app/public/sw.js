const CACHE = 'crashwave-shell-v1';
const SHELL = ['/', '/manifest.json'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => { const request = event.request; if (request.method !== 'GET') return; const url = new URL(request.url); if (url.origin !== self.location.origin) return; event.respondWith(fetch(request).then((response) => { const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request).then((cached) => cached ?? new Response('Offline', { status: 503, statusText: 'Offline' })))); });
