import { describe, expect, it, vi } from "vitest";
import {
  MODEL_STATES,
  baseModelState,
  checkModelCompatibility,
  createModelRegistry,
  isWebGpuCapable,
} from "./registry";

function makeCapability({ state = "available", limits = {} } = {}) {
  return {
    state,
    adapter: state === "available" ? {} : null,
    device: state === "available" ? {} : null,
    limits: {
      maxBufferSize: 268435456,
      maxStorageBufferBindingSize: 134217728,
      ...limits,
    },
  };
}

function makeMemoryCache() {
  const store = new Map();
  return {
    match: async (url) => store.get(url),
    put: async (url, value) => store.set(url, value),
    delete: async (url) => store.delete(url),
    keys: async () => Array.from(store.keys()),
  };
}

const cacheProvider = (cache = makeMemoryCache()) => ({ open: async () => cache });

const MODEL_URL = "https://huggingface.co/WaveCut/Bonsai-web-GGUF/resolve/112ea7a1a6229bde132b176b9a72477a7ecfde64/1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf";

describe("isWebGpuCapable", () => {
  it("requires an available state with adapter and device", () => {
    expect(isWebGpuCapable(makeCapability())).toBe(true);
    expect(isWebGpuCapable(makeCapability({ state: "unsupported" }))).toBe(false);
    expect(isWebGpuCapable(null)).toBe(false);
    expect(isWebGpuCapable({ state: "available", adapter: null, device: {} })).toBe(false);
  });
});

describe("baseModelState", () => {
  it("reports downloaded when weights are cached", () => {
    expect(baseModelState({ hasCachedWeights: true, capability: makeCapability() }))
      .toBe(MODEL_STATES.downloaded);
    expect(baseModelState({ hasCachedWeights: false, capability: makeCapability() }))
      .toBe(MODEL_STATES.notDownloaded);
  });

  it("reports incompatible without WebGPU regardless of cache", () => {
    expect(baseModelState({ hasCachedWeights: true, capability: makeCapability({ state: "unsupported" }) }))
      .toBe(MODEL_STATES.incompatible);
  });
});

describe("checkModelCompatibility", () => {
  it("checks required buffer limits against the adapter", () => {
    const model = { requiredLimits: { maxStorageBufferBindingSize: 43680672 } };
    expect(checkModelCompatibility(model, makeCapability()).compatible).toBe(true);
    const weak = makeCapability({ limits: { maxStorageBufferBindingSize: 1000 } });
    const result = checkModelCompatibility(model, weak);
    expect(result.compatible).toBe(false);
    expect(result.reason).toBe("insufficient-limits");
    expect(result.key).toBe("maxStorageBufferBindingSize");
    expect(result.required).toBe(43680672);
    expect(result.actual).toBe(1000);
  });

  it("flags models that require WebGPU only", () => {
    expect(checkModelCompatibility({ cpuFallback: false, requiredLimits: {} }, makeCapability()))
      .toMatchObject({ compatible: true, requiresWebGpu: true });
  });

  it("rejects when WebGPU is missing", () => {
    const result = checkModelCompatibility(
      { cpuFallback: true, requiredLimits: {} },
      makeCapability({ state: "unsupported" })
    );
    expect(result.compatible).toBe(false);
    expect(result.reason).toBe("no-webgpu");
  });
});

describe("createModelRegistry", () => {
  it("starts notDownloaded and transitions through the download lifecycle", async () => {
    const cache = makeMemoryCache();
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(cache),
    });

    let model = await registry.getModel("bonsai-1.7b");
    expect(model.state).toBe(MODEL_STATES.notDownloaded);
    expect(model.downloadBytes).toBe(248302336);
    expect(model.versionKey).toContain("210a9e99f79cb184909d49595906526eb2b3dd9a");

    registry.beginDownload("bonsai-1.7b");
    model = await registry.getModel("bonsai-1.7b");
    expect(model.state).toBe(MODEL_STATES.downloading);

    await cache.put(MODEL_URL, new Response("weights"));
    await registry.finishDownload("bonsai-1.7b");
    model = await registry.getModel("bonsai-1.7b");
    expect(model.state).toBe(MODEL_STATES.downloaded);

    registry.markLoading("bonsai-1.7b");
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.loading);
    registry.markReady("bonsai-1.7b");
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.ready);
    registry.resetModel("bonsai-1.7b");
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.downloaded);
  });

  it("reports incompatible when the GPU cannot host the model", async () => {
    const registry = createModelRegistry({
      capability: makeCapability({ limits: { maxStorageBufferBindingSize: 1000 } }),
      cacheProvider: cacheProvider(),
    });
    const model = await registry.getModel("bonsai-1.7b");
    expect(model.state).toBe(MODEL_STATES.incompatible);
    expect(model.compatibility.reason).toBe("insufficient-limits");
  });

  it("reports incompatible without WebGPU", async () => {
    const registry = createModelRegistry({
      capability: makeCapability({ state: "unsupported" }),
      cacheProvider: cacheProvider(),
    });
    const model = await registry.getModel("bonsai-1.7b");
    expect(model.state).toBe(MODEL_STATES.incompatible);
    expect(model.compatibility.reason).toBe("no-webgpu");
  });

  it("records errors and retries clear them", async () => {
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(),
    });
    const normalized = registry.fail("bonsai-1.7b", new Error("boom"));
    expect(normalized.code).toBe("storage-failed");
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.error);
    registry.resetModel("bonsai-1.7b");
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.notDownloaded);
  });

  it("evicts cached weights and reports evicted", async () => {
    const cache = makeMemoryCache();
    await cache.put(MODEL_URL, new Response("weights"));
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(cache),
    });
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.downloaded);
    const result = await registry.evictModel("bonsai-1.7b");
    expect(result.state).toBe(MODEL_STATES.evicted);
    expect(result.evicted).toBe(true);
    expect(await cache.match(MODEL_URL)).toBeUndefined();
    expect((await registry.getModel("bonsai-1.7b")).state).toBe(MODEL_STATES.notDownloaded);
  });

  it("lists all catalog models with their state", async () => {
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(),
    });
    const models = await registry.list();
    expect(models).toHaveLength(1);
    expect(models[0].model.id).toBe("bonsai-1.7b");
    expect(models[0].state).toBe(MODEL_STATES.notDownloaded);
  });

  it("notifies state changes", async () => {
    const onStateChange = vi.fn();
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(),
      onStateChange,
    });
    registry.beginDownload("bonsai-1.7b");
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "bonsai-1.7b" })
    );
  });

  it("ignores operations for unknown models", async () => {
    const registry = createModelRegistry({
      capability: makeCapability(),
      cacheProvider: cacheProvider(),
    });
    expect((await registry.getModel("nope")).model).toBeNull();
    registry.beginDownload("nope");
    registry.markReady("nope");
    const evicted = await registry.evictModel("nope");
    expect(evicted.evicted).toBe(false);
  });
});