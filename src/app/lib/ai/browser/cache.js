export const WEIGHT_CACHE_NAME = "modcodes-ai-v1";

export function openWeightCache(cacheProvider, cacheName = WEIGHT_CACHE_NAME) {
  if (!cacheProvider || typeof cacheProvider.open !== "function") {
    return null;
  }
  return cacheProvider.open(cacheName);
}

export async function hasCachedWeight(cache, url) {
  if (!cache || !url) {
    return false;
  }
  try {
    return Boolean(await cache.match(url));
  } catch {
    return false;
  }
}

export async function cacheWeight(cache, url, response) {
  if (!cache || !url || !response) {
    return false;
  }
  try {
    await cache.put(url, response);
    return true;
  } catch {
    return false;
  }
}

export async function removeCachedWeight(cache, url) {
  if (!cache || !url) {
    return false;
  }
  try {
    await cache.delete(url);
    return true;
  } catch {
    return false;
  }
}

export async function listCachedWeightUrls(cache) {
  if (!cache || typeof cache.keys !== "function") {
    return [];
  }
  try {
    const keys = await cache.keys();
    return keys.map((request) =>
      typeof request === "string" ? request : request.url
    );
  } catch {
    return [];
  }
}

export async function weightCacheContainsModel(cache, model) {
  if (!cache || !model) {
    return false;
  }
  for (const file of model.files) {
    if (!(await hasCachedWeight(cache, file.url))) {
      return false;
    }
  }
  return true;
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIndexedDbStore({
  indexedDB,
  dbName = "modcodes-ai",
  storeName = "kv",
} = {}) {
  let dbPromise = null;

  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!indexedDB) {
          reject(new Error("indexedDB is not available"));
          return;
        }
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  };

  return {
    async get(key) {
      const db = await open();
      const tx = db.transaction(storeName, "readonly");
      return promisify(tx.objectStore(storeName).get(key));
    },
    async put(value, key) {
      const db = await open();
      const tx = db.transaction(storeName, "readwrite");
      return promisify(tx.objectStore(storeName).put(value, key));
    },
    async delete(key) {
      const db = await open();
      const tx = db.transaction(storeName, "readwrite");
      return promisify(tx.objectStore(storeName).delete(key));
    },
  };
}

export function normalizeStorageError(error) {
  if (!error) {
    return { code: "storage-failed", retryable: true };
  }
  if (
    error instanceof Error &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return { code: "storage-quota", retryable: false, cause: error };
  }
  return { code: "storage-failed", retryable: true, cause: error };
}

function requestUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input.url === "string") {
    return input.url;
  }
  if (input && typeof input.href === "string") {
    return input.href;
  }
  return String(input);
}

function readHeader(headers, name) {
  if (!headers) {
    return null;
  }
  if (typeof headers.get === "function") {
    try {
      return headers.get(name);
    } catch {
      return null;
    }
  }
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return typeof direct === "string" ? direct : null;
}

function isCacheableWeightRequest(input, init) {
  const method = ((init && init.method) || (typeof input === "object" && input && input.method) || "GET").toUpperCase();
  if (method !== "GET") {
    return false;
  }
  const headers = (init && init.headers) || (typeof input === "object" && input && input.headers) || null;
  // Range responses are partial; serving the full cached body would corrupt
  // any reader that depends on 206 semantics, so those always hit the network.
  return !readHeader(headers, "Range");
}

/**
 * Wraps `fetch` so model weight files already written to the browser weight
 * cache are served from Cache Storage instead of the network. Without this the
 * 200+ MB download performed by `downloadModel` is never actually reused: the
 * runtime fetches the model files again on every load.
 *
 * Only plain GET requests without a Range header are served from the cache;
 * everything else falls through to the network untouched.
 */
export function createWeightCachedFetch({
  cacheName = WEIGHT_CACHE_NAME,
  cacheProvider = null,
  fetchImpl = typeof fetch === "function" ? fetch : null,
} = {}) {
  if (typeof fetchImpl !== "function") {
    return null;
  }
  if (!cacheProvider || typeof cacheProvider.open !== "function") {
    return null;
  }

  return async function weightCachedFetch(input, init) {
    if (!isCacheableWeightRequest(input, init)) {
      return fetchImpl(input, init);
    }
    try {
      const cache = await openWeightCache(cacheProvider, cacheName);
      if (cache) {
        const hit = await cache.match(requestUrl(input));
        if (hit) {
          return hit;
        }
      }
    } catch {
      // Cache Storage unavailable or entry unreadable: fall back to network.
    }
    return fetchImpl(input, init);
  };
}
