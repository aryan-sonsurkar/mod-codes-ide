import { describe, expect, it } from "vitest";
import {
  MODEL_CATALOG,
  MODEL_KINDS,
  QUANT_FACTORS,
  estimateModelRamGb,
  filterModels,
  findModel,
  listModelKinds,
  quantizationBytesPerParam,
} from "./catalog";
import {
  createHardwareProfile,
  detectCpuCores,
  detectDeviceMemory,
  detectGpuInfo,
  hardwareTier,
  recommendModels,
  summarizeHardware,
} from "./hardware";

describe("catalog", () => {
  it("has well-formed entries", () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(5);
    for (const entry of MODEL_CATALOG) {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.name).toBe("string");
      expect(entry.provider).toBe("ollama");
      expect(MODEL_KINDS).toContain(entry.kind);
      expect(entry.contextLength).toBeGreaterThan(0);
      expect(entry.parametersB).toBeGreaterThan(0);
      expect(entry.quantizations.length).toBeGreaterThan(0);
      expect(entry.footprint.minRamGb).toBeGreaterThan(0);
      expect(entry.footprint.recommendedRamGb).toBeGreaterThanOrEqual(
        entry.footprint.minRamGb
      );
    }
  });

  it("finds models by id or base name", () => {
    expect(findModel("qwen2.5-coder:7b")?.base).toBe("qwen2.5-coder");
    expect(findModel("qwen2.5-coder")?.id).toBe("qwen2.5-coder:1.5b");
    expect(findModel("unknown-model")).toBeNull();
    expect(findModel(42)).toBeNull();
  });

  it("lists the supported kinds", () => {
    expect(listModelKinds()).toEqual(MODEL_KINDS);
  });

  it("filters by kind and memory", () => {
    const small = filterModels({ kind: "code", maxRamGb: 8 });
    expect(small.length).toBeGreaterThan(0);
    for (const entry of small) {
      expect(entry.kind).toBe("code");
      expect(entry.footprint.minRamGb).toBeLessThanOrEqual(8);
      expect(typeof entry.estimatedRamGb).toBe("number");
    }
  });

  it("keeps provider filtering strict", () => {
    const fromOtherProvider = filterModels({ provider: "modcodes" });
    expect(fromOtherProvider).toEqual([]);
  });
});

describe("quantization", () => {
  it("maps known tags to bytes per parameter", () => {
    expect(quantizationBytesPerParam("Q4_K_M")).toBe(QUANT_FACTORS.Q4_K_M);
    expect(quantizationBytesPerParam("Q8_0")).toBe(1.0);
    expect(quantizationBytesPerParam("fp16")).toBe(2.0);
  });

  it("returns null for unknown tags", () => {
    expect(quantizationBytesPerParam("SOME_QUANT")).toBeNull();
    expect(quantizationBytesPerParam(undefined)).toBeNull();
    expect(quantizationBytesPerParam(null)).toBeNull();
  });

  it("estimates model memory from parameters", () => {
    const entry = findModel("qwen2.5-coder:7b");
    const estimate = estimateModelRamGb(entry, { quantTag: "Q4_K_M" });
    expect(estimate).toBe(Math.round((7.6 * 0.5 + 0.5) * 10) / 10);
  });

  it("returns null when it cannot estimate", () => {
    expect(estimateModelRamGb(null)).toBeNull();
    expect(
      estimateModelRamGb({ parametersB: 7 }, { quantTag: "UNKNOWN" })
    ).toBeNull();
  });
});

describe("hardware detection", () => {
  it("never invents hardware data", () => {
    expect(detectDeviceMemory()).toBeNull();
    expect(detectGpuInfo()).toBeNull();
    const cores = detectCpuCores();
    expect(cores === null || (Number.isFinite(cores) && cores > 0)).toBe(true);
  });

  it("builds a profile from real signals only", () => {
    const profile = createHardwareProfile();
    expect(profile.deviceMemoryGb).toBeNull();
    expect(profile.gpu).toBeNull();
    expect(
      profile.cpuCores === null ||
        (Number.isFinite(profile.cpuCores) && profile.cpuCores > 0)
    ).toBe(true);
  });

  it("summarizes hardware with an honest tier", () => {
    const summary = summarizeHardware(createHardwareProfile());
    expect(summary.tier).toBeNull();
    expect(summary.deviceMemoryGb).toBeNull();
  });
});

describe("hardware tiers", () => {
  it("classifies memory into tiers", () => {
    expect(hardwareTier(null)).toBeNull();
    expect(hardwareTier(undefined)).toBeNull();
    expect(hardwareTier(4)).toBe("minimal");
    expect(hardwareTier(8)).toBe("small");
    expect(hardwareTier(16)).toBe("medium");
    expect(hardwareTier(32)).toBe("large");
    expect(hardwareTier(64)).toBe("large");
  });
});

describe("recommendModels", () => {
  it("recommends code models that fit the detected memory", () => {
    const result = recommendModels({ memoryGb: 8, kind: "code", limit: 3 });
    expect(result.tier).toBe("small");
    expect(result.memoryGb).toBe(8);
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of result.recommendations) {
      expect(recommendation.model.kind).toBe("code");
      expect(recommendation.model.footprint.minRamGb).toBeLessThanOrEqual(8);
      expect(recommendation.reason).toContain("GB RAM");
    }
  });

  it("returns balanced defaults when memory is unknown", () => {
    const result = recommendModels({ kind: "code", limit: 3 });
    expect(result.tier).toBeNull();
    expect(result.memoryGb).toBeNull();
    expect(result.recommendations.length).toBe(3);
    expect(result.reason).toContain("could not be detected");
  });

  it("respects the limit", () => {
    const result = recommendModels({ memoryGb: 64, kind: "code", limit: 2 });
    expect(result.recommendations.length).toBe(2);
  });

  it("accepts an explicit profile", () => {
    const result = recommendModels({
      profile: { deviceMemoryGb: 16 },
      kind: "general",
      limit: 3,
    });
    expect(result.tier).toBe("medium");
    expect(result.recommendations.every((r) => r.model.kind === "general")).toBe(
      true
    );
  });
});