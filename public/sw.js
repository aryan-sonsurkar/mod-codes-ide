/* global caches, clients, self, Response, Request, URL */

/**
 * MODCODES service worker.
 *
 * Goal: the editor shell keeps working on a flaky college/lab connection, and
 * the Python runtime is downloaded exactly once.
 *
 * - navigations: network first, cache fallback (works offline after first load)
 * - /_next/static and hashed assets: cache first (immutable)
 * - Pyodide runtime: cache first (large, versioned, never changes)
 * - model weights: NOT cached here — they already live in IndexedDB
 */
const VERSION = "modcodes-sw-4";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OWNED_CACHES = [SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE];
const CURRENT_CACHES = new Set(OWNED_CACHES);

const SHELL_URLS = ["/", "/projects", "/settings", "/manifest.json"];
const PRECACHE_MANIFEST_URL = "/precache-manifest.json";
const PRECACHE_ASSET_LIMIT = 400;

const PYODIDE_HOST = "cdn.jsdelivr.net";
const PYODIDE_PREFIX = "/pyodide/";
const RUNTIME_CACHE_LIMIT = 60;

async function putIfReachable(cache, url) {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { "X-SW-Precache": "1" },
    });
    if (response && response.ok) {
      await cache.put(url, response);
      return true;
    }
  } catch (error) {
    // An offline install still succeeds with whatever is already cached.
  }
  return false;
}

async function precacheShell(shellCache, assetCache) {
  await Promise.all(SHELL_URLS.map((url) => putIfReachable(shellCache, url)));

  try {
    const response = await fetch(PRECACHE_MANIFEST_URL, {
      credentials: "same-origin",
      headers: { "X-SW-Precache": "1" },
    });

    if (!response || !response.ok) {
      return;
    }

    const manifest = await response.json();
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

    await Promise.all(
      assets
        .slice(0, PRECACHE_ASSET_LIMIT)
        .map((asset) => putIfReachable(assetCache, asset))
    );
  } catch (error) {
    // Shell HTML alone still gives a usable offline fallback.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      const assetCache = await caches.open(ASSET_CACHE);

      await precacheShell(shellCache, assetCache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("modcodes-sw-") && !CURRENT_CACHES.has(name))
          .map((name) => caches.delete(name))
      );
      if (clients && clients.claim) {
        await clients.claim();
      }
    })()
  );
});

function isNavigation(request, url) {
  return request.mode === "navigate" || url.pathname === "/" || request.destination === "document";
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) {
    return;
  }
  const excess = keys.length - limit;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) {
    return cached;
  }

  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const fallback = await caches.match(request, { ignoreVary: true });
    if (fallback) {
      return fallback;
    }
    throw error;
  }

  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(cacheName, request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) {
      return cached;
    }
    const shell = await caches.match("/", { ignoreVary: true });
    if (shell) {
      return shell;
    }
    return new Response("You are offline and MODCODES has not been cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheRuntime(cacheName, request) {
  const response = await cacheFirst(cacheName, request);
  await trimCache(cacheName, RUNTIME_CACHE_LIMIT);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.headers.has("X-SW-Precache")) {
    return;
  }

  const url = new URL(request.url);

  if (request.headers.has("range")) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) {
    return;
  }

  if (isNavigation(request, url)) {
    event.respondWith(networkFirst(SHELL_CACHE, request));
    return;
  }

  if (url.hostname === PYODIDE_HOST && url.pathname.startsWith(PYODIDE_PREFIX)) {
    event.respondWith(cacheRuntime(ASSET_CACHE, request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(ASSET_CACHE, request));
      return;
    }
    if (/\.(?:svg|png|jpg|jpeg|webp|ico|gif|txt|woff2?|css|json|map)$/i.test(url.pathname)) {
      event.respondWith(cacheFirst(RUNTIME_CACHE, request));
      return;
    }
  }
});
