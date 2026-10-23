// CBN — fonctionne hors connexion (l'application s'ouvre même sans réseau)
// et reçoit les notifications sur le téléphone.
// Les données (rapports, membres…) viennent toujours d'Internet, jamais du cache.
const VERSION = 'cbn-v7';
const FICHIERS = [
  './', 'index.html', 'style.css', 'config.js', 'core.js', 'rapports.js', 'eglise.js', 'fideles.js', 'plan-versets.js', 'parole.js', 'responsables.js', 'agenda.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png'
];
// Bibliothèques et polices venant d'autres sites : gardées pour l'usage hors connexion
const EXTERNES = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'api.getbible.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    // Réseau d'abord (toujours la dernière version), cache si hors connexion
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((rep) => {
          if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
          return rep;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
    );
  } else if (EXTERNES.includes(url.hostname)) {
    // Cache d'abord, mise à jour en arrière-plan
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(e.request).then((enCache) => {
        const reseau = fetch(e.request).then((rep) => { if (rep.ok || rep.type === 'opaque') c.put(e.request, rep.clone()); return rep; }).catch(() => enCache);
        return enCache || reseau;
      }))
    );
  }
});

// ---------- Notifications ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titre: 'CBN', texte: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.titre || 'Cité de la Bonne Nouvelle', {
      body: d.texte || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.id || undefined,
      data: { lien: d.lien || '#/notifications' }, lang: 'fr'
    }),
    self.clients.matchAll({ type: 'window' }).then((fenetres) => fenetres.forEach((f) => f.postMessage({ type: 'notification' })))
  ]));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const lien = (e.notification.data && e.notification.data.lien) || '#/notifications';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
    const f = fenetres.find((x) => x.url.startsWith(self.registration.scope));
    if (f) { f.postMessage({ type: 'ouvrir', lien }); return f.focus(); }
    return self.clients.openWindow(self.registration.scope + lien);
  }));
});
