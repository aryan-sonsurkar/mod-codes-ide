import { describe, expect, it, vi } from "vitest";
import { MODEL_STATES } from "./registry";
import { createModelRegistry } from "./registry";
import {
  DOWNLOAD_STATES,
  describeDownload,
  downloadModel,
  downloadPercent,
  formatBytes,
} from "./download";

function makeMemoryCache() {
  const store = new Map();
  return {
    match: async (url) => store.get(url),
    put: async (url, value) => store.set(url, value),
    delete: async (url) => store.delete(url),
    keys: async () => Array.from(store.keys()),
    _store: store,
  };
}

const MODEL_URL =
  "https://huggingface.co/WaveCut/Bonsai-web-GGUF/resolve/112ea7a1a6229bde132b176b9a72477a7ecfde64/1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf";

const MODEL = {
  id: "bonsai-1.7b",
  files: [
    {
      path: "Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf",
      url: MODEL_URL,
      bytes: 4,
    },
  ],
  downloadBytes: 4,
};

function makeFetchResponse({ bytes, status = 200, contentLength = null }) {
  const body = new Uint8Array(bytes);
  return new Response(body, {
    status,
    headers: contentLength !== null ? { "content-length": String(contentLength) } : {},
  });
}

describe("formatBytes", () => {
  it("formats sizes honestly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(248302336)).toBe("237 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
  });
});

describe("downloadPercent", () => {
  it("returns a real percentage only when the total is known", () => {
    expect(downloadPercent({ bytesLoaded: 2, bytesTotal: 4 })).toBe(50);
    expect(downloadPercent({ bytesLoaded: 0, bytesTotal: 0 })).toBeNull();
    expect(downloadPercent({ bytesLoaded: 2, bytesTotal: null })).toBeNull();
    expect(downloadPercent(null)).toBeNull();
    expect(downloadPercent({ bytesLoaded: 4, bytesTotal: 4 })).toBe(100);
  });
});

describe("describeDownload", () => {
  it("never invents a percentage for unknown totals", () => {
    expect(describeDownload({ state: "downloading", bytesLoaded: 2, bytesTotal: null })).toEqual({
      label: "2 B downloaded",
      percent: null,
      hasPercent: false,
    });
    expect(describeDownload({ state: "downloading", bytesLoaded: 2, bytesTotal: 4 })).toEqual({
      label: "2 B of 4 B",
      percent: 50,
      hasPercent: true,
    });
    expect(describeDownload({ state: "done" })).toMatchObject({ percent: 100, hasPercent: true });
    expect(describeDownload({ state: "error", error: "oops" })).toMatchObject({
      label: "oops",
      percent: null,
    });
    expect(describeDownload(null).label).toBe("Downloading…");
  });
});

async function makeSetup({ bytes = 4, contentLength = null, failStatus = null } = {}) {
  const cache = makeMemoryCache();
  const cacheProvider = { open: async () => cache };
  const registry = createModelRegistry({
    capability: { state: "available", adapter: {}, device: {}, limits: {} },
    cacheProvider,
  });
  const fetchImpl = vi.fn(async (url, options) => {
    if (failStatus !== null) {
      return new Response(null, { status: failStatus });
    }
    return makeFetchResponse({ bytes, contentLength });
  });
  return { cache, cacheProvider, registry, fetchImpl };
}

describe("downloadModel", () => {
  it("downloads a model and marks it downloaded", async () => {
    const { cache, registry, fetchImpl } = await makeSetup();
    const progressEvents = [];
    const result = await downloadModel({
      model: MODEL,
      registry,
      cacheProvider: { open: async () => cache },
      fetchImpl,
      onProgress: (p) => progressEvents.push(p),
    });

    expect(result.state).toBe(DOWNLOAD_STATES.done);
    expect(fetchImpl).toHaveBeenCalledWith(MODEL.files[0].url, expect.anything());
    expect(cache._store.has(MODEL.files[0].url)).toBe(true);
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.downloaded);
    expect(progressEvents.some((p) => p.state === DOWNLOAD_STATES.downloading)).toBe(true);
    expect(progressEvents.some((p) => p.state === DOWNLOAD_STATES.done)).toBe(true);
    const last = progressEvents[progressEvents.length - 1];
    expect(last.bytesLoaded).toBe(4);
    expect(last.bytesTotal).toBe(4);
  });

  it("uses the real content-length when the server reports one", async () => {
    const { cache } = await makeSetup({ bytes: 4, contentLength: 8 });
    const seen = [];
    await downloadModel({
      model: MODEL,
      cacheProvider: { open: async () => cache },
      fetchImpl: async () => makeFetchResponse({ bytes: 4, contentLength: 8 }),
      onProgress: (p) => seen.push(p),
    });
    const downloading = seen.filter((p) => p.state === DOWNLOAD_STATES.downloading).at(-1);
    expect(downloading.bytesTotal).toBe(8);
  });

  it("skips files already in the cache", async () => {
    const cache = makeMemoryCache();
    await cache.put(MODEL.files[0].url, new Response(new Uint8Array(4)));
    const fetchImpl = vi.fn();
    const registry = createModelRegistry({
      capability: { state: "available", adapter: {}, device: {}, limits: {} },
      cacheProvider: { open: async () => cache },
    });
    await downloadModel({
      model: MODEL,
      registry,
      cacheProvider: { open: async () => cache },
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.downloaded);
  });

  it("reports error state and rethrows on HTTP failures", async () => {
    const { cache, registry, fetchImpl } = await makeSetup({ failStatus: 500 });
    await expect(
      downloadModel({
        model: MODEL,
        registry,
        cacheProvider: { open: async () => cache },
        fetchImpl,
      })
    ).rejects.toThrow(/status 500/);
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.error);
    expect(cache._store.size).toBe(0);
  });

  it("fails loudly on size mismatches", async () => {
    const { cache, registry } = await makeSetup();
    await expect(
      downloadModel({
        model: MODEL,
        registry,
        cacheProvider: { open: async () => cache },
        fetchImpl: async () => makeFetchResponse({ bytes: 3 }),
      })
    ).rejects.toThrow(/Size mismatch/);
    expect(cache._store.size).toBe(0);
  });

  it("aborts cleanly and resets the model state", async () => {
    const { cache, registry } = await makeSetup();
    const controller = new AbortController();
    const result = await downloadModel({
      model: MODEL,
      registry,
      cacheProvider: { open: async () => cache },
      fetchImpl: async (url, options) => {
        controller.abort();
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
      signal: controller.signal,
    });
    expect(result.state).toBe(DOWNLOAD_STATES.aborted);
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.notDownloaded);
  });

  it("requires a model and fails when the cache is unavailable", async () => {
    await expect(downloadModel({})).rejects.toThrow("requires a model");
    await expect(
      downloadModel({ model: MODEL, fetchImpl: async () => new Response() })
    ).rejects.toThrow("cache is unavailable");
  });
});