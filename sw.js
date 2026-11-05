const CACHE = "burgut-netlify-v2";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./dashboard.css",
  "./words.js",
  "./app.js",
  "./cloud-sync.js",
  "./cloud-config.js",
  "./logo.svg",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // API — faqat tarmoq (oflayn holatda localStorage nusxasi ishlatiladi)
  if (url.pathname.startsWith("/api/")) return;

  // Sahifa — tarmoq, bo'lmasa kesh
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }

  // Statik fayllar — avval tarmoq (yangilanish darhol ko'rinadi), bo'lmasa kesh
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
