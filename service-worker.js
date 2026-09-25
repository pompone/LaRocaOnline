const CACHE_NAME = "la-roca-v9";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/favicon.ico",
  "./icons/favicon-48.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/logo-la-roca.png",
  "./icons/ministerio.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("la-roca-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const isPageOrCode =
    request.mode === "navigate" ||
    /\.(html|css|js|json)$/i.test(url.pathname);

  if (isPageOrCode) {
    /* Consultar primero al servidor evita quedar en una versión vieja. */
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw new Error("Sin conexión y sin copia guardada");
      })
    );
    return;
  }

  /* Las imágenes pueden servirse desde la caché. */
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(
                (cache) => cache.put(request, copy)
              )
            );
          }
          return response;
        })
    )
  );
});