// Bump VERSION whenever you change any app file, so phones download the update.
const VERSION = "v1";
const CACHE = "workout-tracker-" + VERSION;
const CORE = [
  "./",
  "index.html",
  "styles.css",
  "schedule.js",
  "app.js",
  "manifest.json",
  "icons/icon.svg",
];
const OPTIONAL = [
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(CORE);
      await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first, falling back to the network; navigation falls back to the cached shell offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        if (req.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
