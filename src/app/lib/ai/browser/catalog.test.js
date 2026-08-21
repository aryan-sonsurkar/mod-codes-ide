import { describe, expect, it } from "vitest";
import {
  BONSAI_MODEL_TIERS,
  getModelById,
  isDownloadAllowed,
  listModels,
  modelDownloadBytes,
  modelVersionKey,
} from "./catalog";

describe("catalog", () => {
  it("ships the 1.7B tier with real metadata from the WaveCut manifest", () => {
    expect(BONSAI_MODEL_TIERS).toHaveLength(1);
    const model = getModelById("bonsai-1.7b");
    expect(model.displayName).toBe("Bonsai 1.7B");
    expect(model.architecture).toBe("qwen3");
    expect(model.source.repo).toBe("prism-ml/Bonsai-1.7B-gguf");
    expect(model.source.revision).toBe("210a9e99f79cb184909d49595906526eb2b3dd9a");
    expect(model.source.bytes).toBe(248302272);
    expect(model.downloadBytes).toBe(248302336);
    expect(model.contextLength).toBe(32768);
    expect(model.defaultContext).toBe(4096);
    expect(model.cpuFallback).toBe(true);
    expect(model.largestTensorBytes).toBe(43680672);
    expect(model.requiredLimits.maxStorageBufferBindingSize).toBe(43680672);
    expect(model.runtimePolicy.flashAttention).toBe(false);
    expect(model.runtimePolicy.tokenEmbeddingOnWebGPU).toBe(true);
  });

  it("does not advertise unverified tiers", () => {
    expect(getModelById("bonsai-4b")).toBeNull();
    expect(getModelById("bonsai-8b")).toBeNull();
    expect(getModelById("bonsai-27b")).toBeNull();
    expect(listModels()).toEqual(["bonsai-1.7b"]);
  });

  it("points the single shard at the verified WaveCut resolve URL", () => {
    const model = getModelById("bonsai-1.7b");
    expect(model.files).toHaveLength(1);
    const file = model.files[0];
    expect(file.path).toBe("1_7b/Bonsai-1.7B-Q1_0.gguf-00001-of-00001.gguf");
    expect(file.bytes).toBe(248302336);
    expect(file.url).toContain("WaveCut/Bonsai-web-GGUF");
    expect(file.url).toContain("/1_7b/");
    expect(file.url).toContain("-00001-of-00001.gguf");
  });

  it("versions models by source revision", () => {
    const model = getModelById("bonsai-1.7b");
    const version = modelVersionKey(model);
    expect(version).toContain("210a9e99f79cb184909d49595906526eb2b3dd9a");
    expect(modelVersionKey(model)).toBe(version);
  });

  it("reports the real download size", () => {
    const model = getModelById("bonsai-1.7b");
    expect(modelDownloadBytes(model)).toBe(248302336);
  });

  it("allows download only when declared files have URLs", () => {
    const model = getModelById("bonsai-1.7b");
    expect(isDownloadAllowed(model)).toBe(true);
    expect(isDownloadAllowed(null)).toBe(false);
    expect(isDownloadAllowed({ files: [] })).toBe(false);
    expect(isDownloadAllowed({ source: { repo: "x" }, files: [{ url: "" }] })).toBe(false);
  });
});