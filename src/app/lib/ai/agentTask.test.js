import { describe, expect, it } from "vitest";
import { STEP_STATES, TASK_STATES, createAgentSession, createAgentStep, createAgentTask } from "./agentTask";

describe("agent task", () => {
  it("starts, adds steps, completes", () => {
    const task = createAgentTask({ title: "Add auth" });
    const session = createAgentSession({ task });
    session.start();
    expect(session.getTask().state).toBe(TASK_STATES.planning);
    const step = createAgentStep({ title: "Inspect", reason: "Check routes", expectedTools: ["ide.current-file"] });
    session.addStep(step);
    session.updateStep(step.id, { state: STEP_STATES.completed });
    expect(session.getTask().steps[0].state).toBe(STEP_STATES.completed);
    session.complete();
    expect(session.getTask().state).toBe(TASK_STATES.completed);
  });

  it("cancels and serializes", () => {
    const task = createAgentTask({ title: "Test" });
    const session = createAgentSession({ task });
    const step = createAgentStep({ title: "Step 1" });
    session.addStep(step);
    session.cancel();
    expect(session.getTask().state).toBe(TASK_STATES.cancelled);
    expect(session.serialize().state).toBe(TASK_STATES.cancelled);
  });

  it("fails with reason", () => {
    const session = createAgentSession({ task: createAgentTask({ title: "Fail" }) });
    session.fail("timeout");
    expect(session.getTask().state).toBe(TASK_STATES.failed);
  });
});
