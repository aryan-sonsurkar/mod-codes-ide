import { describe, expect, it } from "vitest";
import { createAgentOrchestrator } from "./agentOrchestrator";
import { createPlanner } from "./agentPlanner";
import { createToolRegistry, createTool } from "./tools";

describe("agent orchestrator", () => {
  it("flows start -> plan -> approve -> changeset -> complete", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({ id: "ide.current-file", name: "Current", permission: "read", execute: async () => "ok" }));
    const orch = createAgentOrchestrator({ planner: createPlanner({}), toolRegistry: registry });
    await orch.startTask({ title: "Find bug and fix it", context: {} });
    expect(["awaitingApproval", "planReady"].includes(orch.getSnapshot().state)).toBe(true);
    orch.approvePlan();
    expect(orch.getSnapshot().state).toBe("executing");
    orch.proposeChangeset({ title: "fix", operations: [{ id: "op1", path: "src/a.js", operation: "modify", original: "a", proposed: "b", status: "pending" }] });
    expect(orch.getSnapshot().state).toBe("awaitingReview");
    orch.complete();
    expect(orch.getSnapshot().state).toBe("completed");
  });

  it("cancellation is observable", async () => {
    const orch = createAgentOrchestrator({ planner: createPlanner({}) });
    await orch.startTask({ title: "Test" });
    orch.cancel();
    expect(orch.getSnapshot().state).toBe("cancelled");
  });

  it("bounds maxSteps", async () => {
    const orch = createAgentOrchestrator({ maxSteps: 2, planner: createPlanner({ maxSteps: 2 }) });
    await orch.startTask({ title: "Test bug" });
    expect(orch.getSnapshot().task.steps.length).toBeLessThanOrEqual(2);
  });
});
