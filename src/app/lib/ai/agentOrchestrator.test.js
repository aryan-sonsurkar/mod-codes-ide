import { describe, expect, it } from "vitest";
import { createAgentOrchestrator } from "./agentOrchestrator";
import { createPlanner } from "./agentPlanner";
import { createToolRegistry, createTool } from "./tools";

function makeFullRegistry() {
  const registry = createToolRegistry();
  const tools = [
    { id: "ide.current-file", execute: async () => "current file content" },
    { id: "ide.open-files", execute: async () => "src/a.js\nsrc/b.js" },
    { id: "ide.diagnostics", execute: async () => "No diagnostics." },
    { id: "ide.search", execute: async () => "search results" },
    { id: "ide.read-file", execute: async (args) => `Content of ${args.path || "file"}` },
    { id: "ide.write-file", execute: async () => ({ ok: true }) },
    { id: "ide.apply-patch", execute: async () => ({ ok: true }) },
    { id: "ide.create-file", execute: async () => ({ ok: true }) },
  ];
  for (const def of tools) {
    registry.registerTool(createTool({ id: def.id, name: def.id, permission: "read", execute: def.execute }));
  }
  return registry;
}

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

describe("agent orchestrator runAgentLoop", () => {
  it("runs through all steps automatically when autoApprove is true", async () => {
    const steps = [];
    const registry = makeFullRegistry();

    const orch = createAgentOrchestrator({
      maxSteps: 5,
      planner: createPlanner({ maxSteps: 3 }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Fix the bug",
      autoApprove: true,
      onStepComplete: ({ step, observation, index, total }) => {
        steps.push({ step: step.title, tool: observation.tool, index, total });
      },
    });

    expect(["completed", "awaitingReview"].includes(result.state)).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    expect(result.observations.length).toBeGreaterThan(0);
  });

  it("stops at awaitingApproval when autoApprove is false", async () => {
    const registry = makeFullRegistry();

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 3 }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Fix the bug",
      autoApprove: false,
    });

    expect(result.state).toBe("awaitingApproval");
  });

  it("cancels mid-loop", async () => {
    const registry = makeFullRegistry();

    const orch = createAgentOrchestrator({
      maxSteps: 10,
      planner: createPlanner({ maxSteps: 5 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Fix the bug in login" });
    orch.cancel();
    expect(orch.getSnapshot().state).toBe("cancelled");
  });
});
