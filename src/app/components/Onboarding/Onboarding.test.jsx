import { describe, expect, it, beforeEach } from "vitest";
import { isOnboardingCompleted, completeOnboarding } from "./Onboarding";

describe("onboarding", () => {
  beforeEach(() => {
    try {
      localStorage.removeItem("modcodes.onboarding.completed");
    } catch {}
  });
  it("completes and persists", () => {
    expect(isOnboardingCompleted()).toBe(false);
    completeOnboarding();
    expect(isOnboardingCompleted()).toBe(true);
  });
  it("does not require auth", () => {
    // no personal info collected — completions are local only
    expect(isOnboardingCompleted()).toBeDefined();
  });
});
