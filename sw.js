// Service worker: guarda los archivos de la app para que abra rápido
// y se pueda instalar en el celular. Los DATOS no se guardan acá:
// siempre se piden frescos a la base.
const VERSION = "gym-v8";
const ARCHIVOS = ["./", "index.html", "estilos.css", "app.js", "datos.js", "config.js", "manifest.json", "logo-192.png", "logo-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Primero la red (para tener siempre la última versión); si no hay, la copia.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
