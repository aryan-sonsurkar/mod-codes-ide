import { MODEL_CATALOG, estimateModelRamGb, filterModels } from "./catalog";

export function detectDeviceMemory() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const value = navigator.deviceMemory;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function detectCpuCores() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const value = navigator.hardwareConcurrency;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function detectGpuInfo() {
  if (
    typeof document === "undefined" ||
    typeof document.createElement !== "function"
  ) {
    return null;
  }

  let canvas;
  try {
    canvas = document.createElement("canvas");
  } catch {
    return null;
  }
  if (!canvas || typeof canvas.getContext !== "function") {
    return null;
  }

  const contextNames = ["webgl", "experimental-webgl"];
  let gl = null;
  for (const name of contextNames) {
    try {
      gl = canvas.getContext(name);
      if (gl) {
        break;
      }
    } catch {
      gl = null;
    }
  }
  if (!gl) {
    return null;
  }

  try {
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    if (!extension) {
      return null;
    }
    const vendor = gl.getParameter(extension.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    if (typeof renderer !== "string") {
      return null;
    }
    return {
      vendor: typeof vendor === "string" ? vendor : null,
      renderer,
    };
  } catch {
    return null;
  }
}

export function createHardwareProfile() {
  return {
    deviceMemoryGb: detectDeviceMemory(),
    cpuCores: detectCpuCores(),
    gpu: detectGpuInfo(),
  };
}

export function hardwareTier(deviceMemoryGb) {
  if (deviceMemoryGb == null || !Number.isFinite(deviceMemoryGb)) {
    return null;
  }
  if (deviceMemoryGb >= 32) {
    return "large";
  }
  if (deviceMemoryGb >= 16) {
    return "medium";
  }
  if (deviceMemoryGb >= 8) {
    return "small";
  }
  return "minimal";
}

export function recommendModels({
  catalog = MODEL_CATALOG,
  profile = null,
  memoryGb = null,
  kind = null,
  quantTag = "Q4_K_M",
  limit = 3,
} = {}) {
  const effectiveMemory = memoryGb != null ? memoryGb : profile?.deviceMemoryGb ?? null;
  const tier = hardwareTier(effectiveMemory);

  const candidates = filterModels({ kind, maxRamGb: effectiveMemory, quantTag });

  candidates.sort((a, b) => {
    if (a.footprint.recommendedRamGb !== b.footprint.recommendedRamGb) {
      return a.footprint.recommendedRamGb - b.footprint.recommendedRamGb;
    }
    return a.parametersB - b.parametersB;
  });

  const recommendations = candidates.slice(0, limit).map((entry) => {
    const estimatedRamGb = estimateModelRamGb(entry, { quantTag });
    return {
      model: entry,
      quantTag,
      estimatedRamGb,
      reason:
        effectiveMemory == null
          ? "RAM is unknown; recommended as a balanced default."
          : `Estimated ${estimatedRamGb} GB in ${effectiveMemory} GB RAM.`,
    };
  });

  return {
    tier,
    memoryGb: effectiveMemory,
    count: recommendations.length,
    recommendations,
    reason:
      effectiveMemory == null
        ? "Device memory could not be detected. Showing balanced defaults."
        : `Detected ${effectiveMemory} GB RAM (${tier || "unknown"} tier).`,
  };
}

export function summarizeHardware(profile) {
  const tier = hardwareTier(profile && profile.deviceMemoryGb);
  return {
    deviceMemoryGb: profile && profile.deviceMemoryGb,
    cpuCores: profile && profile.cpuCores,
    gpu: profile && profile.gpu,
    tier,
  };
}