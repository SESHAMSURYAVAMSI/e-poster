const CACHE_NAME = "eposter-shell-v1";
const PAGE_CACHE = "eposter-pages-v1";
const ASSET_CACHE = "eposter-assets-v1";
const PRECACHE_URLS = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, PAGE_CACHE, ASSET_CACHE].includes(key))
          .filter((key) => key.startsWith("eposter-"))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          return (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/offline.html")) ||
            Response.error();
        })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.ico") {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
