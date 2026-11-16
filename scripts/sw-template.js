/* Daydle service worker — this template is emitted with a build-specific
   cache key and the actual hashed Vite static asset list. Do not serve raw
   template files directly. All authenticated/network data bypasses Cache API. */
/*__DAYDLE_PWA_CONFIG__*/

const OFFLINE_HTML = "/index.html";

function isAppNavigation(url) {
  if (url.pathname === "/" || url.pathname === "/today") return true;
  return url.pathname === "/games" || /^\/games\/[a-z0-9-]+\/?$/.test(url.pathname);
}

function isSafeStaticAsset(url) {
  return url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/app.webmanifest" ||
    url.pathname === "/favicon.svg";
}

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  if (request.headers.has("authorization") || request.headers.has("apikey")) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.search) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth") ||
      url.pathname.startsWith("/account") || url.pathname.startsWith("/rest/") ||
      url.pathname.startsWith("/storage/")) return false;
  return request.mode === "navigate"
    ? isAppNavigation(url)
    : isSafeStaticAsset(url);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("daydle-shell-") && key !== CACHE_NAME) {
        await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(OFFLINE_HTML) ??
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque" &&
        response.headers.get("cache-control")?.includes("private") !== true &&
        response.headers.get("cache-control")?.includes("no-store") !== true) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
