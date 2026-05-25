const CACHE = "ramiarz-v2";
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
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigation — zawsze serwuj index.html (client-side routing)
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/index.html").then((cached) => cached || fetch("/index.html"))
    );
    return;
  }

  // Assety — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
