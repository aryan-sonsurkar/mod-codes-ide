import { describe, it, expect } from "vitest";
import { isValidPhase, suggestNextPhase, phaseProgress, canTransition } from "./state";

describe("project state", () => {
  it("validates phases", () => {
    expect(isValidPhase("idea")).toBe(true);
    expect(isValidPhase("invalid")).toBe(false);
  });
  it("suggests next", () => {
    expect(suggestNextPhase("idea")).toBe("research");
    expect(suggestNextPhase("maintenance")).toBe("maintenance");
  });
  it("progress increases", () => {
    expect(phaseProgress("idea")).toBe(13);
    expect(phaseProgress("maintenance")).toBe(100);
  });
  it("allows any valid transition", () => {
    expect(canTransition("development","research")).toBe(true);
    expect(canTransition("idea","invalid")).toBe(false);
  });
});
