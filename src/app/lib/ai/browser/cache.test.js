import { describe, expect, it, vi } from "vitest";
import {
  WEIGHT_CACHE_NAME,
  cacheWeight,
  createIndexedDbStore,
  hasCachedWeight,
  listCachedWeightUrls,
  normalizeStorageError,
  openWeightCache,
  removeCachedWeight,
  weightCacheContainsModel,
} from "./cache";

function makeMemoryCache() {
  const store = new Map();
  const cache = {
    match: vi.fn(async (url) => store.get(url) || undefined),
    put: vi.fn(async (url, response) => {
      store.set(url, response);
    }),
    delete: vi.fn(async (url) => store.delete(url)),
    keys: vi.fn(async () => Array.from(store.keys())),
    _store: store,
  };
  return cache;
}

function makeCacheProvider(cache = makeMemoryCache()) {
  return {
    open: vi.fn(async () => cache),
    cache,
  };
}

const MODEL_WITH_ONE_FILE = {
  id: "bonsai-1.7b",
  files: [{ url: "https://example.com/weights.gguf" }],
};

describe("weight cache (Cache Storage)", () => {
  it("opens the named cache", async () => {
    const provider = makeCacheProvider();
    const cache = await openWeightCache(provider, WEIGHT_CACHE_NAME);
    expect(cache).toBe(provider.cache);
    expect(provider.open).toHaveBeenCalledWith(WEIGHT_CACHE_NAME);
  });

  it("returns null when there is no cache provider", () => {
    expect(openWeightCache(null)).toBeNull();
    expect(openWeightCache({})).toBeNull();
  });

  it("checks for a cached weight without throwing", async () => {
    const cache = makeMemoryCache();
    await cache.put("https://example.com/weights.gguf", new Response("x"));
    expect(await hasCachedWeight(cache, "https://example.com/weights.gguf")).toBe(true);
    expect(await hasCachedWeight(cache, "https://example.com/other.gguf")).toBe(false);
    expect(await hasCachedWeight(null, "https://example.com/weights.gguf")).toBe(false);
  });

  it("caches a weight and removes it", async () => {
    const cache = makeMemoryCache();
    const response = new Response("weights");
    expect(await cacheWeight(cache, "https://example.com/weights.gguf", response)).toBe(true);
    expect(await hasCachedWeight(cache, "https://example.com/weights.gguf")).toBe(true);
    expect(await removeCachedWeight(cache, "https://example.com/weights.gguf")).toBe(true);
    expect(await hasCachedWeight(cache, "https://example.com/weights.gguf")).toBe(false);
  });

  it("reports failure without throwing when the cache rejects", async () => {
    const failing = {
      put: vi.fn(async () => {
        throw new Error("quota");
      }),
      delete: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    expect(await cacheWeight(failing, "u", new Response("x"))).toBe(false);
    expect(await removeCachedWeight(failing, "u")).toBe(false);
  });

  it("lists cached urls", async () => {
    const cache = makeMemoryCache();
    await cache.put("https://example.com/a.gguf", new Response("a"));
    await cache.put("https://example.com/b.gguf", new Response("b"));
    const urls = await listCachedWeightUrls(cache);
    expect(urls.sort()).toEqual([
      "https://example.com/a.gguf",
      "https://example.com/b.gguf",
    ]);
    expect(await listCachedWeightUrls(null)).toEqual([]);
  });

  it("considers a model cached only when every declared file is present", async () => {
    const cache = makeMemoryCache();
    expect(await weightCacheContainsModel(cache, MODEL_WITH_ONE_FILE)).toBe(false);
    await cache.put("https://example.com/weights.gguf", new Response("w"));
    expect(await weightCacheContainsModel(cache, MODEL_WITH_ONE_FILE)).toBe(true);
    expect(await weightCacheContainsModel(cache, null)).toBe(false);
    expect(await weightCacheContainsModel(null, MODEL_WITH_ONE_FILE)).toBe(false);
  });
});

describe("indexedDB snapshot store", () => {
  function makeFakeIndexedDb() {
    const records = new Map();
    const store = {
      get: vi.fn((key) => {
        const req = {};
        queueMicrotask(() => {
          if (records.has(key)) {
            req.onsuccess?.({ target: { result: records.get(key) } });
          } else {
            req.onsuccess?.({ target: { result: undefined } });
          }
        });
        return req;
      }),
      put: vi.fn((value, key) => {
        const req = {};
        queueMicrotask(() => {
          records.set(key, value);
          req.onsuccess?.({ target: { result: key } });
        });
        return req;
      }),
      delete: vi.fn((key) => {
        const req = {};
        queueMicrotask(() => {
          records.delete(key);
          req.onsuccess?.({ target: { result: undefined } });
        });
        return req;
      }),
    };
    const db = {
      objectStoreNames: { contains: vi.fn(() => true) },
      createObjectStore: vi.fn(() => store),
      transaction: vi.fn((_name, mode) => ({
        objectStore: () => store,
        mode,
      })),
    };
    const indexedDB = {
      open: vi.fn(() => {
        const req = {};
        queueMicrotask(() => {
          req.onupgradeneeded?.({ target: { result: db } });
          req.onsuccess?.({ target: { result: db } });
        });
        return req;
      }),
    };
    return { indexedDB, db, records };
  }

  it("round-trips structured values via put/get/delete", async () => {
    const { indexedDB } = makeFakeIndexedDb();
    const store = createIndexedDbStore({ indexedDB });
    const snapshot = { tokens: [1, 2, 3], buffer: new Uint8Array([9, 8, 7]) };
    await store.put(snapshot, "kv:conversation:abc");
    const loaded = await store.get("kv:conversation:abc");
    expect(loaded).toEqual(snapshot);
    await store.delete("kv:conversation:abc");
    expect(await store.get("kv:conversation:abc")).toBeUndefined();
  });

  it("creates the object store on upgrade", async () => {
    const fake = makeFakeIndexedDb();
    fake.db.objectStoreNames.contains.mockReturnValue(false);
    const store = createIndexedDbStore({ indexedDB: fake.indexedDB, dbName: "db", storeName: "kv" });
    await store.get("x");
    expect(fake.db.createObjectStore).toHaveBeenCalledWith("kv");
  });

  it("rejects when indexedDB is unavailable", async () => {
    const store = createIndexedDbStore({ indexedDB: null });
    await expect(store.get("x")).rejects.toThrow("indexedDB is not available");
  });
});

describe("normalizeStorageError", () => {
  it("maps quota errors to a non-retryable storage-quota code", () => {
    expect(normalizeStorageError(new DOMException("full", "QuotaExceededError"))).toMatchObject({
      code: "storage-quota",
      retryable: false,
    });
    const named = new Error("full");
    named.name = "NS_ERROR_DOM_QUOTA_REACHED";
    expect(normalizeStorageError(named)).toMatchObject({ code: "storage-quota", retryable: false });
  });

  it("keeps generic errors retryable", () => {
    expect(normalizeStorageError(new Error("boom"))).toMatchObject({
      code: "storage-failed",
      retryable: true,
    });
    expect(normalizeStorageError(null)).toMatchObject({ code: "storage-failed", retryable: true });
  });
});