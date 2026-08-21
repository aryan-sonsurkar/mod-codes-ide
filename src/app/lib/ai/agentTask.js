export const TASK_STATES = {
  idle: "idle",
  planning: "planning",
  awaitingApproval: "awaitingApproval",
  executing: "executing",
  observing: "observing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
};

export const STEP_STATES = {
  pending: "pending",
  running: "running",
  waitingApproval: "waitingApproval",
  completed: "completed",
  failed: "failed",
  rejected: "rejected",
  cancelled: "cancelled",
};

let nextTaskId = 0;
let nextStepId = 0;

export function createAgentTask({ id = null, title, description = null } = {}) {
  if (typeof title !== "string" || title.length === 0) {
    throw new TypeError("Task title is required");
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : `task-${nextTaskId++}-${Date.now()}`,
    title: title.slice(0, 120),
    description: typeof description === "string" ? description.slice(0, 500) : null,
    state: TASK_STATES.idle,
    steps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createAgentStep({ id = null, title, reason = null, expectedTools = [], expectedFiles = [], risk = null } = {}) {
  if (typeof title !== "string" || title.length === 0) {
    throw new TypeError("Step title is required");
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : `step-${nextStepId++}-${Date.now()}`,
    title: title.slice(0, 120),
    reason: typeof reason === "string" ? reason.slice(0, 300) : null,
    expectedTools: Array.isArray(expectedTools) ? expectedTools.slice(0, 10) : [],
    expectedFiles: Array.isArray(expectedFiles) ? expectedFiles.slice(0, 20) : [],
    risk: typeof risk === "string" ? risk : null,
    state: STEP_STATES.pending,
  };
}

export function createAgentSession({ task } = {}) {
  let current = task ? { ...task } : createAgentTask({ title: "Agent task" });
  let cancelled = false;

  return {
    getTask() {
      return { ...current, steps: [...current.steps] };
    },
    start() {
      if (cancelled) {
        return current;
      }
      current = { ...current, state: TASK_STATES.planning, updatedAt: Date.now() };
      return current;
    },
    addStep(step) {
      current = { ...current, steps: [...current.steps, step], updatedAt: Date.now() };
      return current;
    },
    updateStep(stepId, patch) {
      current = {
        ...current,
        steps: current.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
        updatedAt: Date.now(),
      };
      return current;
    },
    setState(state) {
      if (!Object.values(TASK_STATES).includes(state)) {
        throw new TypeError(`Invalid task state: ${state}`);
      }
      current = { ...current, state, updatedAt: Date.now() };
      return current;
    },
    complete() {
      current = { ...current, state: TASK_STATES.completed, updatedAt: Date.now() };
      return current;
    },
    fail(reason) {
      current = { ...current, state: TASK_STATES.failed, failureReason: reason || null, updatedAt: Date.now() };
      return current;
    },
    cancel() {
      cancelled = true;
      current = { ...current, state: TASK_STATES.cancelled, updatedAt: Date.now() };
      for (const step of current.steps) {
        if (step.state === STEP_STATES.pending || step.state === STEP_STATES.running) {
          step.state = STEP_STATES.cancelled;
        }
      }
      return current;
    },
    serialize() {
      return JSON.parse(JSON.stringify(current));
    },
  };
}

export function resetAgentIdsForTests() {
  nextTaskId = 0;
  nextStepId = 0;
}
