/* Spelling EN service worker — offline app shell + runtime caching. */
const CACHE = "spelling-en-v2";
const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./install.html",
  "./privacy.html",
  "./sfx/correct.wav",
  "./sfx/wrong.wav",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/mascot.png",
  "./fonts/Andika-Regular.woff2",
  "./fonts/Andika-Bold.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // Only this app's old caches: the other apps on this origin share Cache Storage.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("spelling-en-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App navigations: serve the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  // Same-origin: cache-first, then fill the cache. Cross-origin (Tesseract CDN,
  // its language data): just go to network and let the browser HTTP cache handle it.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit)
      )
    );
  }
});
