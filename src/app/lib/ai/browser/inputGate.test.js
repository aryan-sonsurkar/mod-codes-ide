import { describe, expect, it } from "vitest";
import { PROVIDER_STATES } from "../providerStates";
import { MODEL_STATES } from "./registry";
import { isBonsaiInputDisabled, isModelUsableForChat } from "./inputGate";

const READY = PROVIDER_STATES.ready;

describe("isModelUsableForChat", () => {
  it("accepts cached weights and a resident engine", () => {
    expect(isModelUsableForChat({ state: MODEL_STATES.downloaded })).toBe(true);
    expect(isModelUsableForChat({ state: MODEL_STATES.ready })).toBe(true);
  });

  it("rejects every other state", () => {
    expect(isModelUsableForChat(null)).toBe(false);
    expect(isModelUsableForChat(undefined)).toBe(false);
    expect(isModelUsableForChat({})).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.notDownloaded })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.downloading })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.loading })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.unloading })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.error })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.evicted })).toBe(false);
    expect(isModelUsableForChat({ state: MODEL_STATES.incompatible })).toBe(false);
  });
});

describe("isBonsaiInputDisabled", () => {
  it("is disabled until the provider reports ready", () => {
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.unknown, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.checking, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.busy, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.unavailable, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.unsupported, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.idle, providerId: "ollama" })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({ status: PROVIDER_STATES.degraded, providerId: "ollama" })
    ).toBe(true);
  });

  it("ignores model state for non-Bonsai providers", () => {
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "ollama",
        browserModelInfo: null,
      })
    ).toBe(false);
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "ollama",
        browserModelInfo: { state: MODEL_STATES.notDownloaded },
      })
    ).toBe(false);
  });

  it("keeps Bonsai enabled once the engine is resident (regression)", () => {
    // After the first reply the registry flips downloaded -> ready. Gating on
    // `downloaded` alone locked the composer forever.
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: { state: MODEL_STATES.ready },
      })
    ).toBe(false);
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: { state: MODEL_STATES.downloaded },
      })
    ).toBe(false);
  });

  it("blocks Bonsai while weights are missing or the model is failed", () => {
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: { state: MODEL_STATES.notDownloaded },
      })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: { state: MODEL_STATES.loading },
      })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: { state: MODEL_STATES.error },
      })
    ).toBe(true);
    expect(
      isBonsaiInputDisabled({
        status: READY,
        providerId: "browser-bonsai",
        browserModelInfo: null,
      })
    ).toBe(true);
  });
});
