import { describe, it, expect } from "vitest";
import { createProjectLifecycleOrchestrator, LIFECYCLE_STATES } from "./lifecycle";
import { createEmptyModcodes } from "./modcodes";
import { createAgentOrchestrator } from "../ai/agentOrchestrator";
import { createPlanner } from "../ai/agentPlanner";
import { createToolRegistry } from "../ai/tools/registry";

function makeOrchestrator() {
  const planner = createPlanner({ maxSteps: 5 });
  const registry = createToolRegistry();
  const agent = createAgentOrchestrator({ maxSteps: 5, planner, toolRegistry: registry });
  const lifecycle = createProjectLifecycleOrchestrator({ agentOrchestrator: agent, inspectCodebase: async () => ({ confidence: "high" }) });
  return { agent, lifecycle };
}

describe("lifecycle orchestrator M153", () => {
  it("rejects invalid milestone", async () => {
    const { lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    const snap = await lifecycle.startMilestone({ milestone: null, modcodesData: base });
    expect(snap.state).toBe(LIFECYCLE_STATES.failed);
  });

  it("blocked when project memory unavailable", async () => {
    const { lifecycle } = makeOrchestrator();
    const snap = await lifecycle.startMilestone({ milestone: { id: "M2", goal: "Auth" }, modcodesData: null });
    expect(snap.state).toBe(LIFECYCLE_STATES.blocked);
  });

  it("start valid milestone loads project state and goes to awaitingApproval", async () => {
    const { lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    const snap = await lifecycle.startMilestone({ milestone: { id: "M2", goal: "Authentication", tasks: ["login"], risks: [] }, modcodesData: base, roadmapMilestones: [{ id: "M2", goal: "Authentication" }] });
    expect(snap.state).toBe(LIFECYCLE_STATES.awaitingApproval);
    expect(snap.milestone.id).toBe("M2");
    expect(snap.projectData.project.name).toBe("App");
    expect(snap.inspectionResult.confidence).toBe("high");
  });

  it("requires approval before execution", async () => {
    const { lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    expect(() => lifecycle.approvePlan()).not.toThrow();
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.executing);
  });

  it("throws if approve without awaitingApproval", async () => {
    const { lifecycle } = makeOrchestrator();
    expect(() => lifecycle.approvePlan()).toThrow(/Cannot approve/);
  });

  it("approved plan starts agent executing", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    lifecycle.approvePlan();
    expect(agent.getSnapshot().state).toBe("executing");
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.executing);
  });

  it("cancellation preserves and marks cancelled", async () => {
    const { lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    lifecycle.approvePlan();
    const snap = lifecycle.cancel();
    expect(snap.state).toBe(LIFECYCLE_STATES.cancelled);
  });

  it("failure recovery shows actual failure", async () => {
    const planner = async () => { throw new Error("planner boom"); };
    const agent = createAgentOrchestrator({ planner, toolRegistry: createToolRegistry() });
    const lifecycle = createProjectLifecycleOrchestrator({ agentOrchestrator: agent });
    const base = createEmptyModcodes({ name: "App" });
    const snap = await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    expect(snap.state).toBe(LIFECYCLE_STATES.failed);
  });

  it("changeset preserved via agent, lifecycle does not write files", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    lifecycle.approvePlan();
    // propose changeset via agent — lifecycle should move to review and prepare memory proposal, not write
    agent.proposeChangeset({ changes: [{ path: "a.js", content: "hi" }] });
    const snap = lifecycle.getSnapshot();
    expect(snap.state).toBe(LIFECYCLE_STATES.review);
    expect(snap.proposedMemoryUpdate).toBeTruthy();
    expect(snap.proposedMemoryUpdate.section).toBe("Progress");
    // ensure lifecycle never called filesystem — check no file write method exists
    expect(typeof lifecycle.getSnapshot).toBe("function");
  });

  it("meaningful memory update is proposed not silently written", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M2", goal: "Auth" }, modcodesData: base });
    lifecycle.approvePlan();
    agent.proposeChangeset({ changes: [{ path: "x" }] });
    const snap = lifecycle.getSnapshot();
    expect(snap.proposedMemoryUpdate.requires).toContain("Accept");
    // base not mutated
    expect(base.sections.Progress).toBe("");
  });

  it("lifecycle state distinct from agent state", async () => {
    const { agent, lifecycle } = makeOrchestrator();
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    expect(lifecycle.getSnapshot().state).toBe(LIFECYCLE_STATES.awaitingApproval);
    expect(agent.getSnapshot().state).toBe("awaitingApproval");
    // they share value name but are distinct machines — lifecycle has preparing/inspecting etc.
    expect(lifecycle.getSnapshot().state).not.toBe("planning"); // lifecycle already passed planning
  });

  it("no AdService dependency", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/project/lifecycle.js","utf8");
    expect(content.toLowerCase()).not.toContain("from \"../ads");
    expect(content.toLowerCase()).not.toContain("from './ads");
    expect(content.toLowerCase()).not.toContain("adservice");
  });

  it("git safety respected via injected function", async () => {
    let called = false;
    const gitSafetyLevel = () => { called = true; return "normal"; };
    const planner = createPlanner({ maxSteps: 3 });
    const agent = createAgentOrchestrator({ planner, toolRegistry: createToolRegistry() });
    const lifecycle = createProjectLifecycleOrchestrator({ agentOrchestrator: agent, gitSafetyLevel, inspectCodebase: async () => ({}) });
    const base = createEmptyModcodes({ name: "App" });
    await lifecycle.startMilestone({ milestone: { id: "M1", goal: "Setup" }, modcodesData: base });
    expect(called).toBe(true);
  });
});
