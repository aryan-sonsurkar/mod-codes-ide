import { describe, expect, it, vi } from "vitest";
import { createAgentOrchestrator, ORCHESTRATOR_STATES } from "./agentOrchestrator";
import { createPlanner } from "./agentPlanner";
import { createToolRegistry, createTool } from "./tools";
import { TASK_STATES, STEP_STATES } from "./agentTask";
import { observationsToChangeset } from "./agentChangeGeneration";

function makeFullRegistry() {
  const registry = createToolRegistry();
  const tools = [
    { id: "ide.current-file", execute: async () => "current file content" },
    { id: "ide.open-files", execute: async () => "src/a.js\nsrc/b.js" },
    { id: "ide.diagnostics", execute: async () => "No diagnostics." },
    { id: "ide.search", execute: async () => "search results" },
    { id: "ide.read-file", execute: async (args) => `Content of ${args.path || "file"}` },
    { id: "ide.write-file", execute: async (args) => ({ ok: true, content: args.content || "written" }) },
    { id: "ide.apply-patch", execute: async (args) => ({ ok: true, content: args.patch || "patched" }) },
    { id: "ide.create-file", execute: async (args) => ({ ok: true, content: args.content || "created" }) },
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

describe("agent orchestrator error recovery", () => {
  it("retries failed tool execution", async () => {
    let attempts = 0;
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => {
        attempts++;
        if (attempts < 3) throw new Error("Temporary failure");
        return "success after retries";
      },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 2,
      maxRetries: 3,
      retryDelayMs: 10,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Read file with retries" });
    orch.approvePlan();

    const obs = await orch.executeStep(
      { toolName: "ide.read-file", args: { path: "test.js" } }
    );

    expect(obs.status).toBe("success");
    expect(obs.attempt).toBe(3);
    expect(attempts).toBe(3);
  });

  it("uses fallback tool when primary fails", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => { throw new Error("Read failed"); },
    }));
    registry.registerTool(createTool({
      id: "ide.current-file",
      name: "Current",
      permission: "read",
      execute: async () => "fallback content",
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 2,
      maxRetries: 0,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Read with fallback" });
    orch.approvePlan();

    const obs = await orch.executeStep(
      { toolName: "ide.read-file", args: { path: "test.js" } }
    );

    expect(obs.status).toBe("success");
    expect(obs.fallback).toBe(true);
    expect(obs.originalTool).toBe("ide.read-file");
    expect(obs.tool).toBe("ide.current-file");
  });

  it("continues loop after step failure when continueOnError is true", async () => {
    let stepResults = [];
    const registry = createToolRegistry();
    let callCount = 0;

    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => {
        callCount++;
        if (callCount === 1) throw new Error("First call fails");
        return "success";
      },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 5,
      maxRetries: 0,
      planner: createPlanner({ maxSteps: 3 }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Continue on error",
      autoApprove: true,
      continueOnError: true,
      onStepComplete: ({ step, observation, failed }) => {
        stepResults.push({ title: step.title, failed: failed || false });
      },
    });

    expect(result.state).toBe("awaitingReview");
    expect(stepResults.length).toBeGreaterThan(0);
    expect(stepResults.some((s) => s.failed)).toBe(true);
  });

  it("stops loop after maxConsecutiveFailures", async () => {
    let stepCount = 0;
    const registry = createToolRegistry();

    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => { throw new Error("Always fails"); },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 10,
      maxRetries: 0,
      planner: createPlanner({ maxSteps: 8 }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Fail repeatedly",
      autoApprove: true,
      continueOnError: true,
      onStepComplete: () => { stepCount++; },
    });

    expect(stepCount).toBeLessThanOrEqual(4);
  });

  it("tracks error history", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => { throw new Error("Test error"); },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 2,
      maxRetries: 1,
      retryDelayMs: 10,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Track errors" });
    orch.approvePlan();

    try {
      await orch.executeStep({ toolName: "ide.read-file", args: { path: "test.js" } });
    } catch {
      // Expected
    }

    const history = orch.getErrorHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].tool).toBe("ide.read-file");
    expect(history[0].error).toBe("Test error");
  });

  it("reports retry count", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => { throw new Error("Fail"); },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 2,
      maxRetries: 2,
      retryDelayMs: 10,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Count retries" });
    orch.approvePlan();

    try {
      await orch.executeStep({ toolName: "ide.read-file", args: { path: "test.js" } });
    } catch {
      // Expected
    }

    expect(orch.getRetryCount()).toBeGreaterThan(0);
  });

  it("includes error metadata in changeset", async () => {
    const registry = createToolRegistry();
    let callCount = 0;

    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => {
        callCount++;
        if (callCount === 1) throw new Error("First fails");
        return "original content";
      },
    }));

    registry.registerTool(createTool({
      id: "ide.write-file",
      name: "Write",
      permission: "write",
      execute: async (args) => ({ ok: true, path: args.path, content: args.content || "written" }),
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      maxRetries: 0,
      planner: async () => ({
        id: "plan-1",
        steps: [
          { title: "Read file", expectedTools: ["ide.read-file"], expectedFiles: ["test.js"], risk: "low" },
          { title: "Write file", expectedTools: ["ide.write-file"], expectedFiles: ["test.js"], risk: "medium" },
        ],
      }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Changeset with errors",
      autoApprove: true,
      continueOnError: true,
    });

    expect(result.changeset).toBeTruthy();
    expect(result.changeset.metadata).toBeTruthy();
    expect(result.changeset.metadata.failedSteps).toBeGreaterThanOrEqual(0);
  });
});

describe("agent orchestrator integration", () => {
  it("completes full lifecycle with mock provider", async () => {
    const mockProvider = {
      chat: async () => ({
        ok: true,
        text: JSON.stringify({
          steps: [
            { title: "Read config", reason: "Check settings", expectedTools: ["ide.read-file"], expectedFiles: ["config.json"], risk: "low" },
            { title: "Write fix", reason: "Fix the issue", expectedTools: ["ide.write-file"], expectedFiles: ["config.json"], risk: "medium" },
          ],
        }),
      }),
    };

    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async (args) => `Content of ${args.path}`,
    }));
    registry.registerTool(createTool({
      id: "ide.write-file",
      name: "Write",
      permission: "write",
      execute: async (args) => ({ ok: true, path: args.path, content: args.content || "written" }),
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 5,
      planner: createPlanner({ maxSteps: 5, provider: mockProvider, model: "test" }),
      toolRegistry: registry,
    });

    const snapshots = [];
    orch.subscribe((snap) => snapshots.push(snap.state));

    const result = await orch.runAgentLoop({
      title: "Fix configuration",
      description: "Read config and write fix",
      autoApprove: true,
      context: { openDocuments: ["config.json"] },
    });

    expect(result.state).toBe("awaitingReview");
    expect(result.plan).toBeTruthy();
    expect(result.plan.steps.length).toBe(2);
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.changeset).toBeTruthy();

    expect(snapshots).toContain("planning");
    expect(snapshots).toContain("executing");
  });

  it("emits state transitions in correct order", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.current-file",
      name: "Current",
      permission: "read",
      execute: async () => "file content",
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    const stateOrder = [];
    orch.subscribe((snap) => {
      if (stateOrder[stateOrder.length - 1] !== snap.state) {
        stateOrder.push(snap.state);
      }
    });

    await orch.runAgentLoop({
      title: "Simple task",
      autoApprove: true,
    });

    expect(stateOrder[0]).toBe("planning");
    expect(stateOrder).toContain("executing");
    expect(stateOrder[stateOrder.length - 1]).toBe("awaitingReview");
  });

  it("handles empty plan gracefully", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.current-file",
      name: "Current",
      permission: "read",
      execute: async () => "content",
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: async () => ({ id: "plan-empty", steps: [] }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Empty plan task",
      autoApprove: true,
    });

    expect(result.state).toBe("awaitingReview");
    expect(result.observations.length).toBe(0);
  });

  it("supports multiple subscribers", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.current-file",
      name: "Current",
      permission: "read",
      execute: async () => "content",
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 2,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    const subscriber1 = vi.fn();
    const subscriber2 = vi.fn();

    const unsub1 = orch.subscribe(subscriber1);
    const unsub2 = orch.subscribe(subscriber2);

    await orch.startTask({ title: "Test subscribers" });

    expect(subscriber1).toHaveBeenCalled();
    expect(subscriber2).toHaveBeenCalled();

    unsub1();
    orch.cancel();

    expect(subscriber1.mock.calls.length).toBeLessThan(subscriber2.mock.calls.length);
  });

  it("tracks task session state correctly", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => "content",
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 2 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Track task state" });
    let snap = orch.getSnapshot();
    expect(snap.task.state).toBe(TASK_STATES.awaitingApproval);

    orch.approvePlan();
    snap = orch.getSnapshot();
    expect(snap.task.state).toBe(TASK_STATES.executing);

    orch.cancel();
    snap = orch.getSnapshot();
    expect(snap.task.state).toBe(TASK_STATES.cancelled);
  });

  it("rejects plan and transitions to failed", async () => {
    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 2 }),
    });

    await orch.startTask({ title: "Plan to reject" });
    expect(orch.getSnapshot().state).toBe("awaitingApproval");

    orch.rejectPlan("Bad plan");
    expect(orch.getSnapshot().state).toBe("failed");
    expect(orch.getSnapshot().task.failureReason).toBe("Bad plan");
  });

  it("fails gracefully when tool registry is missing", async () => {
    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 1 }),
    });

    await orch.startTask({ title: "No registry task" });
    orch.approvePlan();

    await expect(
      orch.executeStep({ toolName: "ide.read-file", args: {} })
    ).rejects.toThrow("Tool registry not configured");
  });

  it("rejects concurrent step execution attempts", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "content";
      },
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 3,
      planner: createPlanner({ maxSteps: 1 }),
      toolRegistry: registry,
    });

    await orch.startTask({ title: "Concurrent test" });
    orch.approvePlan();

    const promise1 = orch.executeStep({ toolName: "ide.read-file", args: { path: "a.js" } });

    await expect(
      orch.executeStep({ toolName: "ide.read-file", args: { path: "b.js" } })
    ).rejects.toThrow("Cannot execute in state observing");

    await promise1;
  });

  it("reports correct bounds in snapshot", async () => {
    const orch = createAgentOrchestrator({
      maxSteps: 7,
      maxToolRounds: 3,
      contextBudget: 16000,
      timeoutMs: 60000,
    });

    const snap = orch.getSnapshot();
    expect(snap.bounds.maxSteps).toBe(7);
    expect(snap.bounds.maxToolRounds).toBe(3);
    expect(snap.bounds.contextBudget).toBe(16000);
    expect(snap.bounds.timeoutMs).toBe(60000);
  });

  it("generates changeset with actual file content from observations", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({
      id: "ide.read-file",
      name: "Read",
      permission: "read",
      execute: async (args) => {
        if (args.path === "config.json") return '{"debug": false}';
        return "content";
      },
    }));
    registry.registerTool(createTool({
      id: "ide.write-file",
      name: "Write",
      permission: "write",
      execute: async (args) => ({ ok: true, path: args.path, content: args.content || "written" }),
    }));

    const orch = createAgentOrchestrator({
      maxSteps: 5,
      planner: async () => ({
        id: "plan-1",
        steps: [
          { title: "Read config", expectedTools: ["ide.read-file"], expectedFiles: ["config.json"], risk: "low" },
          { title: "Write config", expectedTools: ["ide.write-file"], expectedFiles: ["config.json"], risk: "medium" },
        ],
      }),
      toolRegistry: registry,
    });

    const result = await orch.runAgentLoop({
      title: "Update config",
      autoApprove: true,
    });

    expect(result.changeset).toBeTruthy();
    if (result.changeset && result.changeset.operations.length > 0) {
      const writeOp = result.changeset.operations.find((op) => op.operation === "modify" || op.operation === "create");
      if (writeOp) {
        expect(writeOp.path).toBeTruthy();
        expect(writeOp.proposed).toBeTruthy();
      }
    }
  });
});

describe("observationsToChangeset", () => {
  it("creates changeset from read and write observations", () => {
    const observations = [
      {
        tool: "ide.read-file",
        arguments: { path: "src/app.js" },
        result: "original content",
        status: "success",
      },
      {
        tool: "ide.write-file",
        arguments: { path: "src/app.js", content: "new content" },
        result: { ok: true },
        status: "success",
      },
    ];

    const changeset = observationsToChangeset({
      title: "Test changeset",
      observations,
    });

    expect(changeset).toBeTruthy();
    expect(changeset.operations.length).toBe(1);
    expect(changeset.operations[0].path).toBe("src/app.js");
    expect(changeset.operations[0].original).toBe("original content");
    expect(changeset.operations[0].proposed).toBe("new content");
    expect(changeset.operations[0].operation).toBe("modify");
  });

  it("creates changeset for new files", () => {
    const observations = [
      {
        tool: "ide.create-file",
        arguments: { path: "src/new.js", content: "new file content" },
        result: { ok: true },
        status: "success",
      },
    ];

    const changeset = observationsToChangeset({
      title: "New file",
      observations,
    });

    expect(changeset).toBeTruthy();
    expect(changeset.operations.length).toBe(1);
    expect(changeset.operations[0].operation).toBe("create");
    expect(changeset.operations[0].proposed).toBe("new file content");
  });

  it("returns null when no write operations", () => {
    const observations = [
      {
        tool: "ide.read-file",
        arguments: { path: "src/app.js" },
        result: "content",
        status: "success",
      },
    ];

    const changeset = observationsToChangeset({
      title: "Read only",
      observations,
    });

    expect(changeset).toBeNull();
  });

  it("handles multiple file operations", () => {
    const observations = [
      {
        tool: "ide.read-file",
        arguments: { path: "a.js" },
        result: "original a",
        status: "success",
      },
      {
        tool: "ide.read-file",
        arguments: { path: "b.js" },
        result: "original b",
        status: "success",
      },
      {
        tool: "ide.write-file",
        arguments: { path: "a.js", content: "new a" },
        result: { ok: true },
        status: "success",
      },
      {
        tool: "ide.write-file",
        arguments: { path: "b.js", content: "new b" },
        result: { ok: true },
        status: "success",
      },
    ];

    const changeset = observationsToChangeset({
      title: "Multiple files",
      observations,
    });

    expect(changeset).toBeTruthy();
    expect(changeset.operations.length).toBe(2);
    expect(changeset.operations[0].path).toBe("a.js");
    expect(changeset.operations[1].path).toBe("b.js");
  });

  it("ignores failed observations", () => {
    const observations = [
      {
        tool: "ide.write-file",
        arguments: { path: "src/app.js", content: "content" },
        result: "error",
        status: "error",
      },
    ];

    const changeset = observationsToChangeset({
      title: "Failed ops",
      observations,
    });

    expect(changeset).toBeNull();
  });
});
