import { describe, expect, it } from "vitest";
import { CAPABILITIES, hasCapability, normalizeCapabilities } from "./capabilities";

describe("capabilities", () => {
  it("normalizes capabilities", () => {
    expect(normalizeCapabilities(["chat", "streaming", "unknown"])).toEqual(["chat", "streaming"]);
  });

  it("checks capability via provider or model", () => {
    expect(hasCapability({ capabilities: ["chat", "local"] }, CAPABILITIES.chat)).toBe(true);
    expect(hasCapability({ capabilities: ["chat"] }, CAPABILITIES.browser)).toBe(false);
  });
});
