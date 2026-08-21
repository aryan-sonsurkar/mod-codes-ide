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