/* Smart Eye service worker — caches the app shell for fast loads and an
   offline-aware fallback. The AI screening itself needs the backend, so when
   offline we still show the shell; API calls will fail gracefully in the UI. */
const CACHE = "smart-eye-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Never cache API calls — always go to network (they need the live backend).
  if (req.method !== "GET" || req.url.includes("/api/")) return;
  // Cache-first for the shell/static assets, falling back to network then cache.
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    )
  );
});
