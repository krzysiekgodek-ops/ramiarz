const CACHE = "ramiarz-v1";
const PRECACHE = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API calls — always network, no cache
  if (url.pathname.startsWith("/api/")) return;
  // Everything else — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
