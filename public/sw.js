const CACHE_NAME = "__EDUNOZA_CACHE_NAME__";
const PRECACHE_ASSETS = /* __EDUNOZA_PRECACHE_ASSETS__ */ [];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const rootUrl = new URL("./", self.registration.scope);
  const requests = [
    new Request(rootUrl, { cache: "reload" }),
    ...PRECACHE_ASSETS.map(
      (assetPath) => new Request(new URL(assetPath, rootUrl), { cache: "reload" })
    )
  ];
  await cache.addAll(requests);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("edunoza-") || key.startsWith("profeplus-")) &&
                key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const rootUrl = new URL("./", self.registration.scope);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === rootUrl.pathname) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(rootUrl, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(rootUrl)) ??
            (await cache.match(request, { ignoreSearch: true }))
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        void cache.put(request, copy).catch(() => {});
      }
      return response;
    })
  );
});
