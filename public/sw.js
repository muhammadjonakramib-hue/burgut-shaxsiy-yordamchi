const CACHE = "burgut-offline-v5";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./dashboard.css",
  "./words.js",
  "./offline.js",
  "./pronunciation-data.json",
  "./word-levels.js",
  "./word-audio.mjs",
  "./pronunciation-core.mjs",
  "./words-premium.css",
  "./app.js",
  "./planner.mjs",
  "./planner-core.mjs",
  "./planner.css",
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
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => /^burgut-(daily|offline)-/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
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
    e.respondWith(caches.open(CACHE).then(async cache => (await cache.match('./index.html')) || fetch(e.request)));
    return;
  }

  // A versioned shell must stay coherent, even during a partial deployment.
  e.respondWith(
    caches.open(CACHE).then(async cache => (await cache.match(e.request)) || fetch(e.request)
      .then((res) => {
        return res;
      })
      .catch(() => new Response('', {status:503})))
  );
});

self.addEventListener('message', event => {
  if(event.data?.type !== 'BURGUT_OFFLINE_CHECK')return;
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const present=await Promise.all(SHELL.map(path=>cache.match(path)));
    event.ports[0]?.postMessage({ready:present.every(Boolean),version:CACHE});
  }));
});

self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification('Kunlik reja',{body:String(data.body||'Rejangizni tekshiring'),tag:String(data.tag||'daily'),icon:'/icon-192.png',data:{url:'/#daily'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(existing){await existing.navigate('/#daily');return existing.focus();}
    return clients.openWindow('/#daily');
  }));
});
