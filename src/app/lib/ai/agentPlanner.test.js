import { describe, expect, it } from "vitest";
import { createPlanner, validateAgentPlan } from "./agentPlanner";

describe("agent planner", () => {
  it("creates a bounded plan", async () => {
    const planner = createPlanner({ maxSteps: 5 });
    const plan = await planner({ title: "Find bug and fix it", context: {} });
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.length).toBeLessThanOrEqual(5);
  });

  it("validates step count and tools", () => {
    expect(() => validateAgentPlan({ steps: [] })).toThrow();
    expect(() => validateAgentPlan({ steps: [{ title: "", expectedTools: ["unknown"] }] })).toThrow();
  });

  it("rejects malformed plans", async () => {
    expect(() => validateAgentPlan({ steps: [{ title: "ok", expectedTools: ["bad-tool"] }] })).toThrow();
  });
});
