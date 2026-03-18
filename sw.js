const CACHE_STATIC = 'emulador-static-v1';
const CACHE_ASSETS = 'emulador-assets-v1';

const STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './loader.js',
  './emulator.min.js',
  './emulator.min.css',
  './games.json',
  './logo.png',
  './data/emulator.min.js',
  './data/emulator.min.css',
  './data/loader.js',
];

// Instala e pré-caches os arquivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_ASSETS)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Cache First para assets, Network First para games.json
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora requisições externas
  if (url.origin !== location.origin) return;

  // games.json: sempre tenta rede primeiro, cai no cache se offline
  if (url.pathname.endsWith('games.json')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Covers, cores WASM, ROMs: Cache First, guarda ao acessar pela 1ª vez
  const isAsset =
    url.pathname.startsWith('/covers/') ||
    url.pathname.startsWith('/data/cores/') ||
    url.pathname.startsWith('/roms/');

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_ASSETS).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Demais arquivos: Cache First
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
        return res;
      })
    )
  );
});
