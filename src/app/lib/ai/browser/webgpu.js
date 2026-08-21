export const WEBGPU_STATES = {
  unknown: "unknown",
  unsupported: "unsupported",
  available: "available",
  initializing: "initializing",
  failed: "failed",
  lost: "lost",
};

export const WEBGPU_REASONS = {
  noWebGpu: "no-webgpu",
  noAdapter: "no-adapter",
  noDevice: "no-device",
  error: "error",
};

export function getGpuObject(navigator) {
  if (typeof navigator === "undefined" || !navigator || !navigator.gpu) {
    return null;
  }
  return navigator.gpu;
}

export async function requestAdapter(gpu, { powerPreference = "default" } = {}) {
  if (!gpu) {
    return null;
  }
  try {
    const adapter =
      powerPreference && powerPreference !== "default"
        ? await gpu.requestAdapter({ powerPreference })
        : await gpu.requestAdapter();
    return adapter || null;
  } catch {
    return null;
  }
}

export async function requestDevice(adapter, options = {}) {
  if (!adapter || typeof adapter.requestDevice !== "function") {
    return null;
  }
  try {
    const device = await adapter.requestDevice(options);
    return device || null;
  } catch {
    return null;
  }
}

export async function readAdapterInfo(adapter) {
  if (!adapter || typeof adapter.requestAdapterInfo !== "function") {
    return null;
  }
  try {
    const info = await adapter.requestAdapterInfo();
    if (!info) {
      return null;
    }
    return {
      vendor: typeof info.vendor === "string" ? info.vendor : null,
      architecture:
        typeof info.architecture === "string" ? info.architecture : null,
      description:
        typeof info.description === "string" ? info.description : null,
      device: typeof info.device === "string" ? info.device : null,
    };
  } catch {
    return null;
  }
}

export function readAdapterLimits(adapter) {
  if (!adapter || !adapter.limits || typeof adapter.limits !== "object") {
    return null;
  }
  const pick = (key) =>
    typeof adapter.limits[key] === "number" ? adapter.limits[key] : null;
  return {
    maxBufferSize: pick("maxBufferSize"),
    maxStorageBufferBindingSize: pick("maxStorageBufferBindingSize"),
    maxComputeWorkgroupSizeX: pick("maxComputeWorkgroupSizeX"),
  };
}

export function watchDeviceLost(device) {
  if (!device || typeof device.lost?.then !== "function") {
    return { promise: null };
  }
  const promise = device.lost
    .then(() => WEBGPU_STATES.lost)
    .catch(() => WEBGPU_STATES.lost);
  return { promise };
}

export function capabilityFromState(state, reason = null) {
  return {
    state,
    reason,
    adapter: null,
    device: null,
    info: null,
    limits: null,
    at: Date.now(),
  };
}

export async function detectWebGpuCapability({
  navigator: nav =
    typeof navigator !== "undefined" ? navigator : null,
  powerPreference = "default",
} = {}) {
  if (!nav || !nav.gpu) {
    return capabilityFromState(WEBGPU_STATES.unsupported, WEBGPU_REASONS.noWebGpu);
  }

  const adapter = await requestAdapter(nav.gpu, { powerPreference });
  if (!adapter) {
    return capabilityFromState(WEBGPU_STATES.failed, WEBGPU_REASONS.noAdapter);
  }

  const device = await requestDevice(adapter);
  if (!device) {
    return capabilityFromState(WEBGPU_STATES.failed, WEBGPU_REASONS.noDevice);
  }

  return {
    state: WEBGPU_STATES.available,
    reason: null,
    adapter,
    device,
    info: await readAdapterInfo(adapter),
    limits: readAdapterLimits(adapter),
    at: Date.now(),
  };
}

export function isWebGpuAvailable(capability) {
  return Boolean(
    capability &&
      capability.state === WEBGPU_STATES.available &&
      capability.adapter &&
      capability.device
  );
}

export function describeCapability(capability) {
  if (!capability) {
    return "WebGPU status is unknown.";
  }
  switch (capability.state) {
    case WEBGPU_STATES.available: {
      const gpu = capability.info && capability.info.description
        ? capability.info.description
        : null;
      const adapter = capability.info && capability.info.adapter ? capability.info.adapter : null;
      const detail = gpu || adapter ? ` — ${gpu || adapter}` : "";
      return `WebGPU is available.${detail}`;
    }
    case WEBGPU_STATES.unsupported:
      return "WebGPU is not supported in this browser. Use Chrome or Edge on desktop.";
    case WEBGPU_STATES.initializing:
      return "WebGPU is initializing…";
    case WEBGPU_STATES.failed:
      if (capability.reason === WEBGPU_REASONS.noAdapter) {
        return "WebGPU exists, but no GPU adapter is available.";
      }
      if (capability.reason === WEBGPU_REASONS.noDevice) {
        return "A GPU adapter was found, but no device could be created.";
      }
      return "WebGPU initialization failed.";
    case WEBGPU_STATES.lost:
      return "The WebGPU device was lost.";
    default:
      return "WebGPU status is unknown.";
  }
}