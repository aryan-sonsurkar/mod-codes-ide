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

  it("includes read-file and write tools in fallback plans", async () => {
    const planner = createPlanner({ maxSteps: 10 });
    const plan = await planner({ title: "Add a new feature", context: {} });
    const allTools = plan.steps.flatMap((s) => s.expectedTools || []);
    expect(allTools).toContain("ide.open-files");
    expect(allTools.some((t) => t === "ide.read-file" || t === "ide.write-file" || t === "ide.apply-patch")).toBe(true);
  });

  it("uses LLM provider when available", async () => {
    const mockProvider = {
      chat: async () => ({
        ok: true,
        text: JSON.stringify({
          steps: [
            { title: "Read file", reason: "Understand code", expectedTools: ["ide.read-file"], risk: "low" },
            { title: "Apply fix", reason: "Fix the bug", expectedTools: ["ide.apply-patch"], risk: "medium" },
          ],
        }),
      }),
    };
    const planner = createPlanner({ maxSteps: 5, provider: mockProvider, model: "test-model" });
    const plan = await planner({ title: "Fix login bug", context: { openDocuments: ["src/auth.js"] } });
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[0].title).toBe("Read file");
    expect(plan.steps[0].expectedTools).toContain("ide.read-file");
    expect(plan.steps[1].expectedTools).toContain("ide.apply-patch");
  });

  it("falls back to keyword plan when LLM fails", async () => {
    const failingProvider = {
      chat: async () => { throw new Error("LLM unavailable"); },
    };
    const planner = createPlanner({ maxSteps: 5, provider: failingProvider, model: "test" });
    const plan = await planner({ title: "Fix the bug in login", context: {} });
    expect(plan.steps.length).toBeGreaterThan(0);
    const allTools = plan.steps.flatMap((s) => s.expectedTools || []);
    expect(allTools).toContain("ide.diagnostics");
  });

  it("aborts when signal is already aborted", async () => {
    const planner = createPlanner({});
    const controller = new AbortController();
    controller.abort();
    await expect(
      planner({ title: "Test", signal: controller.signal })
    ).rejects.toThrow("Planning cancelled");
  });
});
