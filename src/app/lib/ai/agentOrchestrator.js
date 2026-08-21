import { TASK_STATES, createAgentSession, createAgentTask } from "./agentTask";

export const ORCHESTRATOR_STATES = {
  idle: "idle",
  planning: "planning",
  planReady: "planReady",
  awaitingApproval: "awaitingApproval",
  approved: "approved",
  executing: "executing",
  observing: "observing",
  changesProposed: "changesProposed",
  awaitingReview: "awaitingReview",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
};

export function createAgentOrchestrator({
  maxSteps = 10,
  maxToolRounds = 4,
  contextBudget = 24000,
  timeoutMs = 30000,
  planner = null,
  toolRegistry = null,
} = {}) {
  let state = ORCHESTRATOR_STATES.idle;
  let taskSession = createAgentSession({ task: createAgentTask({ title: "Idle" }) });
  let plan = null;
  let observations = [];
  let changeset = null;
  let abortController = null;
  const listeners = new Set();

  function emit() {
    for (const l of listeners) {
      l(getSnapshot());
    }
  }

  function getSnapshot() {
    return {
      state,
      task: taskSession.getTask(),
      plan,
      observations: [...observations],
      changeset,
      bounds: { maxSteps, maxToolRounds, contextBudget, timeoutMs },
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function ensureNotCancelled() {
    if (abortController && abortController.signal.aborted) {
      state = ORCHESTRATOR_STATES.cancelled;
      taskSession.cancel();
    }
  }

  async function startTask({ title, description, context } = {}) {
    if (!title || typeof title !== "string") {
      throw new TypeError("Task title is required");
    }
    if (state !== ORCHESTRATOR_STATES.idle && state !== ORCHESTRATOR_STATES.completed && state !== ORCHESTRATOR_STATES.cancelled && state !== ORCHESTRATOR_STATES.failed) {
      throw new Error(`Cannot start task in state ${state}`);
    }
    abortController = new AbortController();
    const task = createAgentTask({ title, description });
    taskSession = createAgentSession({ task });
    taskSession.start();
    state = ORCHESTRATOR_STATES.planning;
    observations = [];
    changeset = null;
    plan = null;
    emit();

    if (typeof planner === "function") {
      try {
        const produced = await planner({ title, description, context, signal: abortController.signal, bounds: { maxSteps, contextBudget } });
        if (abortController.signal.aborted) {
          state = ORCHESTRATOR_STATES.cancelled;
          taskSession.cancel();
          emit();
          return getSnapshot();
        }
        plan = produced;
        if (Array.isArray(plan.steps)) {
          for (const step of plan.steps.slice(0, maxSteps)) {
            taskSession.addStep(step);
          }
        }
        state = ORCHESTRATOR_STATES.planReady;
        taskSession.setState(TASK_STATES.awaitingApproval);
        state = ORCHESTRATOR_STATES.awaitingApproval;
        emit();
      } catch (error) {
        state = ORCHESTRATOR_STATES.failed;
        taskSession.fail(error && error.message ? error.message : "Planner failed");
        emit();
      }
    } else {
      state = ORCHESTRATOR_STATES.awaitingApproval;
      taskSession.setState(TASK_STATES.awaitingApproval);
      emit();
    }
    return getSnapshot();
  }

  function approvePlan() {
    if (state !== ORCHESTRATOR_STATES.awaitingApproval && state !== ORCHESTRATOR_STATES.planReady) {
      throw new Error(`Cannot approve in state ${state}`);
    }
    state = ORCHESTRATOR_STATES.approved;
    taskSession.setState(TASK_STATES.executing);
    state = ORCHESTRATOR_STATES.executing;
    emit();
    return getSnapshot();
  }

  function rejectPlan(reason) {
    state = ORCHESTRATOR_STATES.failed;
    taskSession.fail(reason || "Plan rejected");
    emit();
    return getSnapshot();
  }

  async function executeStep({ toolName, args, permission } = {}, execFn) {
    if (state !== ORCHESTRATOR_STATES.executing && state !== ORCHESTRATOR_STATES.approved) {
      throw new Error(`Cannot execute in state ${state}`);
    }
    ensureNotCancelled();
    if (state === ORCHESTRATOR_STATES.cancelled) {
      return getSnapshot();
    }
    if (!toolRegistry) {
      throw new Error("Tool registry not configured");
    }
    const tool = toolRegistry.getTool ? toolRegistry.getTool(toolName) : null;
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    // Permission check — only read allowed automatically
    if (permission && permission !== "read" && tool.permission !== "read") {
      throw new Error(`Tool ${toolName} requires approval for ${tool.permission}`);
    }
    state = ORCHESTRATOR_STATES.observing;
    emit();
    const start = Date.now();
    let result;
    try {
      if (typeof execFn === "function") {
        result = await execFn({ toolName, args });
      } else {
        result = await toolRegistry.executeToolCall
          ? await toolRegistry.executeToolCall({ toolName, args })
          : await tool.execute(args);
      }
      const obs = { tool: toolName, arguments: args, result, status: "success", durationMs: Date.now() - start, timestamp: Date.now() };
      observations.push(obs);
      state = ORCHESTRATOR_STATES.executing;
      emit();
      return obs;
    } catch (error) {
      const obs = { tool: toolName, arguments: args, result: error && error.message ? error.message : String(error), status: "error", durationMs: Date.now() - start, timestamp: Date.now() };
      observations.push(obs);
      state = ORCHESTRATOR_STATES.failed;
      taskSession.fail(obs.result);
      emit();
      throw error;
    }
  }

  function proposeChangeset(nextChangeset) {
    changeset = nextChangeset;
    state = ORCHESTRATOR_STATES.changesProposed;
    taskSession.setState(TASK_STATES.observing);
    state = ORCHESTRATOR_STATES.awaitingReview;
    emit();
    return getSnapshot();
  }

  function complete() {
    state = ORCHESTRATOR_STATES.completed;
    taskSession.complete();
    emit();
    return getSnapshot();
  }

  function cancel() {
    if (abortController) {
      abortController.abort();
    }
    state = ORCHESTRATOR_STATES.cancelled;
    taskSession.cancel();
    emit();
    return getSnapshot();
  }

  function fail(reason) {
    state = ORCHESTRATOR_STATES.failed;
    taskSession.fail(reason);
    emit();
    return getSnapshot();
  }

  return {
    getSnapshot,
    subscribe,
    startTask,
    approvePlan,
    rejectPlan,
    executeStep,
    proposeChangeset,
    complete,
    cancel,
    fail,
  };
}
