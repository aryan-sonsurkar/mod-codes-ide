import { describe, expect, it, vi } from "vitest";
import {
  WEBGPU_STATES,
  WEBGPU_REASONS,
  describeCapability,
  detectWebGpuCapability,
  getGpuObject,
  isWebGpuAvailable,
  readAdapterInfo,
  readAdapterLimits,
  requestAdapter,
  requestDevice,
  watchDeviceLost,
} from "./webgpu";

function makeGpu({ adapter = true, adapterInfo = {}, limits = {} } = {}) {
  const infoPromise = Promise.resolve({
    vendor: "MockVendor",
    architecture: "mock",
    description: "Mock GPU",
    device: "0x1234",
    ...adapterInfo,
  });
  const gpuAdapter = {
    requestAdapterInfo: vi.fn(() => infoPromise),
    requestDevice: vi.fn(async () => ({ lost: Promise.resolve(null) })),
    limits: {
      maxBufferSize: 268435456,
      maxStorageBufferBindingSize: 134217728,
      maxComputeWorkgroupSizeX: 256,
      ...limits,
    },
  };
  return {
    requestAdapter: vi.fn(async () => (adapter ? gpuAdapter : null)),
    gpuAdapter,
  };
}

describe("getGpuObject", () => {
  it("returns null without a navigator", () => {
    expect(getGpuObject(undefined)).toBeNull();
  });

  it("returns null when WebGPU is missing", () => {
    expect(getGpuObject({})).toBeNull();
    expect(getGpuObject({ gpu: undefined })).toBeNull();
  });

  it("returns the gpu object when present", () => {
    const gpu = { requestAdapter: vi.fn() };
    expect(getGpuObject({ gpu })).toBe(gpu);
  });
});

describe("requestAdapter / requestDevice", () => {
  it("requests an adapter and falls back to null on failure", async () => {
    const ok = makeGpu();
    expect(await requestAdapter(ok)).toBe(ok.gpuAdapter);
    expect(ok.requestAdapter).toHaveBeenCalledWith();

    const missing = makeGpu({ adapter: false });
    expect(await requestAdapter(missing)).toBeNull();

    const throws = { requestAdapter: vi.fn(async () => {
      throw new Error("nope");
    }) };
    expect(await requestAdapter(throws)).toBeNull();
    expect(await requestAdapter(null)).toBeNull();
  });

  it("passes powerPreference through", async () => {
    const gpu = makeGpu();
    await requestAdapter(gpu, { powerPreference: "high-performance" });
    expect(gpu.requestAdapter).toHaveBeenCalledWith({ powerPreference: "high-performance" });
  });

  it("requests a device and falls back to null on failure", async () => {
    const gpu = makeGpu();
    expect(await requestDevice(gpu.gpuAdapter)).toBeDefined();

    const noDevice = { requestDevice: vi.fn(async () => null) };
    expect(await requestDevice(noDevice)).toBeNull();

    const throws = { requestDevice: vi.fn(async () => {
      throw new Error("boom");
    }) };
    expect(await requestDevice(throws)).toBeNull();
    expect(await requestDevice(null)).toBeNull();
  });
});

describe("readAdapterInfo", () => {
  it("reads basic adapter information without aggressive fingerprinting", async () => {
    const gpu = makeGpu();
    const info = await readAdapterInfo(gpu.gpuAdapter);
    expect(info).toEqual({
      vendor: "MockVendor",
      architecture: "mock",
      description: "Mock GPU",
      device: "0x1234",
    });
  });

  it("returns null when unavailable or failing", async () => {
    expect(await readAdapterInfo(null)).toBeNull();
    const noInfo = { requestAdapterInfo: vi.fn(async () => null) };
    expect(await readAdapterInfo(noInfo)).toBeNull();
    const throws = { requestAdapterInfo: vi.fn(async () => {
      throw new Error("denied");
    }) };
    expect(await readAdapterInfo(throws)).toBeNull();
    const missing = {};
    expect(await readAdapterInfo(missing)).toBeNull();
  });
});

describe("readAdapterLimits", () => {
  it("reads buffer size limits", () => {
    const gpu = makeGpu();
    expect(readAdapterLimits(gpu.gpuAdapter)).toEqual({
      maxBufferSize: 268435456,
      maxStorageBufferBindingSize: 134217728,
      maxComputeWorkgroupSizeX: 256,
    });
  });

  it("returns null when limits are missing", () => {
    expect(readAdapterLimits(null)).toBeNull();
    expect(readAdapterLimits({})).toBeNull();
  });
});

describe("watchDeviceLost", () => {
  it("resolves to lost when the device is lost", async () => {
    let resolveLost;
    const device = { lost: new Promise((resolve) => { resolveLost = resolve; }) };
    const { promise } = watchDeviceLost(device);
    resolveLost({ reason: "destroyed", message: "gone" });
    await expect(promise).resolves.toBe(WEBGPU_STATES.lost);
  });

  it("returns a null promise when unsupported", () => {
    expect(watchDeviceLost(null).promise).toBeNull();
    expect(watchDeviceLost({}).promise).toBeNull();
  });
});

describe("detectWebGpuCapability", () => {
  it("reports unsupported when navigator.gpu is missing", async () => {
    const cap = await detectWebGpuCapability({ navigator: {} });
    expect(cap.state).toBe(WEBGPU_STATES.unsupported);
    expect(cap.reason).toBe(WEBGPU_REASONS.noWebGpu);
    expect(cap.adapter).toBeNull();
  });

  it("reports unsupported without a navigator (SSR safe)", async () => {
    const cap = await detectWebGpuCapability({ navigator: undefined });
    expect(cap.state).toBe(WEBGPU_STATES.unsupported);
  });

  it("reports failed when no adapter is available", async () => {
    const gpu = makeGpu({ adapter: false });
    const cap = await detectWebGpuCapability({ navigator: { gpu } });
    expect(cap.state).toBe(WEBGPU_STATES.failed);
    expect(cap.reason).toBe(WEBGPU_REASONS.noAdapter);
  });

  it("reports failed when a device cannot be created", async () => {
    const gpu = makeGpu();
    gpu.gpuAdapter.requestDevice = vi.fn(async () => null);
    const cap = await detectWebGpuCapability({ navigator: { gpu } });
    expect(cap.state).toBe(WEBGPU_STATES.failed);
    expect(cap.reason).toBe(WEBGPU_REASONS.noDevice);
  });

  it("reports available with adapter, device, info and limits", async () => {
    const gpu = makeGpu();
    const cap = await detectWebGpuCapability({ navigator: { gpu } });
    expect(cap.state).toBe(WEBGPU_STATES.available);
    expect(cap.adapter).toBe(gpu.gpuAdapter);
    expect(cap.device).toBeDefined();
    expect(cap.info.description).toBe("Mock GPU");
    expect(cap.limits.maxBufferSize).toBe(268435456);
    expect(isWebGpuAvailable(cap)).toBe(true);
  });

  it("keeps working when adapter info fails", async () => {
    const gpu = makeGpu({ adapterInfo: null });
    gpu.gpuAdapter.requestAdapterInfo = vi.fn(async () => null);
    const cap = await detectWebGpuCapability({ navigator: { gpu } });
    expect(cap.state).toBe(WEBGPU_STATES.available);
    expect(cap.info).toBeNull();
  });
});

describe("describeCapability", () => {
  it("describes each user-facing state", () => {
    expect(describeCapability(null)).toContain("unknown");
    expect(
      describeCapability({ state: WEBGPU_STATES.unsupported })
    ).toContain("not supported");
    expect(
      describeCapability({ state: WEBGPU_STATES.initializing })
    ).toContain("initializing");
    expect(
      describeCapability({ state: WEBGPU_STATES.lost })
    ).toContain("lost");
    expect(
      describeCapability({ state: WEBGPU_STATES.failed, reason: WEBGPU_REASONS.noAdapter })
    ).toContain("no GPU adapter");
    expect(
      describeCapability({ state: WEBGPU_STATES.failed, reason: WEBGPU_REASONS.noDevice })
    ).toContain("no device");
    expect(
      describeCapability({ state: WEBGPU_STATES.available })
    ).toContain("available");
    expect(
      describeCapability({
        state: WEBGPU_STATES.available,
        info: { description: "Arc A770" },
      })
    ).toContain("Arc A770");
  });
});