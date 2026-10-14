/* Service worker do Tira-Dúvidas Fast Track.
   - O HTML (navegação) é buscado primeiro na rede, com revalidação, e só cai
     para o cache se estiver offline ou a rede demorar mais de 4 s. Assim o
     assessor vê a lista de capitães e os links mais recentes sempre que tiver
     internet.
   - Demais arquivos do app (ícones, manifest): cache com atualização em segundo plano.
   - A busca (Fuse.js) está embutida no index.html, sem dependência externa.
   Ao publicar, troque o VERSION: o app avisa quem estiver com ele aberto e os
   caches de versões anteriores são apagados. */
const VERSION = '2026-10-14.1';
const CACHE_PREFIX = 'tira-duvidas-ft-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function networkFirst(request) {
  var network = fetch(request, { cache: 'no-cache' }).then(function (response) {
    if (response && response.status === 200) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy.clone());
        cache.put('./index.html', copy);
      });
    }
    return response;
  });
  var timeout = new Promise(function (_, reject) {
    setTimeout(function () { reject(new Error('timeout')); }, NETWORK_TIMEOUT_MS);
  });
  return Promise.race([network, timeout]).catch(function () {
    return caches.match(request, { ignoreSearch: true })
      .then(function (hit) { return hit || caches.match('./index.html'); })
      .then(function (hit) { return hit || network; });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var network = fetch(request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || network;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
