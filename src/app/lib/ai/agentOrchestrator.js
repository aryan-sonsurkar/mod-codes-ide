import { TASK_STATES, createAgentSession, createAgentTask } from "./agentTask";
import { observationsToChangeset } from "./agentChangeGeneration";

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

const TOOL_FALLBACKS = {
  "ide.read-file": ["ide.current-file", "ide.search"],
  "ide.write-file": ["ide.apply-patch"],
  "ide.apply-patch": ["ide.write-file"],
  "ide.create-file": ["ide.write-file"],
  "ide.search": ["ide.open-files"],
  "ide.current-file": ["ide.read-file"],
  "ide.diagnostics": [],
  "ide.open-files": [],
};

export function createAgentOrchestrator({
  maxSteps = 10,
  maxToolRounds = 4,
  contextBudget = 24000,
  timeoutMs = 30000,
  maxRetries = 2,
  retryDelayMs = 1000,
  planner = null,
  toolRegistry = null,
  provider = null,
  model = null,
} = {}) {
  let state = ORCHESTRATOR_STATES.idle;
  let taskSession = createAgentSession({ task: createAgentTask({ title: "Idle" }) });
  let plan = null;
  let observations = [];
  let changeset = null;
  let abortController = null;
  let retryCount = 0;
  let errorHistory = [];
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getFallbackTools(toolName) {
    return TOOL_FALLBACKS[toolName] || [];
  }

  function recordError(toolName, args, error, attempt) {
    errorHistory.push({
      tool: toolName,
      args,
      error: error && error.message ? error.message : String(error),
      attempt,
      timestamp: Date.now(),
    });
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
    return getSnapshot();
  }

  async function executeStepWithRetry({ toolName, args, permission, retryCount: attemptRetry } = {}, execFn) {
    const maxAttempts = (attemptRetry !== undefined ? attemptRetry : maxRetries) + 1;
    let lastError = null;
    let attemptsMade = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsMade++;
      ensureNotCancelled();
      if (state === ORCHESTRATOR_STATES.cancelled) {
        return null;
      }

      if (!toolRegistry) {
        throw new Error("Tool registry not configured");
      }

      const tool = toolRegistry.getTool ? toolRegistry.getTool(toolName) : null;
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      state = ORCHESTRATOR_STATES.observing;
      emit();
      const start = Date.now();

      try {
        let result;
        if (typeof execFn === "function") {
          result = await execFn({ toolName, args });
        } else {
          result = await toolRegistry.executeToolCall
            ? await toolRegistry.executeToolCall({ toolName, args })
            : await tool.execute(args);
        }

        const obs = {
          tool: toolName,
          arguments: args,
          result,
          status: "success",
          durationMs: Date.now() - start,
          timestamp: Date.now(),
          attempt,
        };
        observations.push(obs);
        state = ORCHESTRATOR_STATES.executing;
        emit();
        return obs;
      } catch (error) {
        lastError = error;
        recordError(toolName, args, error, attempt);
        retryCount++;

        if (attempt < maxAttempts) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
      }
    }

    const fallbackTools = getFallbackTools(toolName);
    for (const fallbackTool of fallbackTools) {
      ensureNotCancelled();
      if (state === ORCHESTRATOR_STATES.cancelled) {
        return null;
      }

      const fallbackToolDef = toolRegistry.getTool ? toolRegistry.getTool(fallbackTool) : null;
      if (!fallbackToolDef) continue;

      state = ORCHESTRATOR_STATES.observing;
      emit();
      const start = Date.now();

      try {
        let result;
        if (typeof execFn === "function") {
          result = await execFn({ toolName: fallbackTool, args });
        } else {
          result = await toolRegistry.executeToolCall
            ? await toolRegistry.executeToolCall({ toolName: fallbackTool, args })
            : await fallbackToolDef.execute(args);
        }

        const obs = {
          tool: fallbackTool,
          arguments: args,
          result,
          status: "success",
          durationMs: Date.now() - start,
          timestamp: Date.now(),
          fallback: true,
          originalTool: toolName,
        };
        observations.push(obs);
        state = ORCHESTRATOR_STATES.executing;
        emit();
        return obs;
      } catch (fallbackError) {
        recordError(fallbackTool, args, fallbackError, 1);
      }
    }

    const errorMessage = lastError && lastError.message ? lastError.message : String(lastError);
    const obs = {
      tool: toolName,
      arguments: args,
      result: errorMessage,
      status: "error",
      durationMs: 0,
      timestamp: Date.now(),
      attempts: maxAttempts,
      fallbacksAttempted: fallbackTools,
    };
    observations.push(obs);
    state = ORCHESTRATOR_STATES.failed;
    taskSession.fail(errorMessage);
    emit();
    throw lastError;
  }

  async function executeStep({ toolName, args, permission } = {}, execFn) {
    if (state !== ORCHESTRATOR_STATES.executing && state !== ORCHESTRATOR_STATES.approved) {
      throw new Error(`Cannot execute in state ${state}`);
    }
    ensureNotCancelled();
    if (state === ORCHESTRATOR_STATES.cancelled) {
      return getSnapshot();
    }
    return executeStepWithRetry({ toolName, args, permission }, execFn);
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

  async function runAgentLoop({ title, description, context, onStepComplete, execFn, autoApprove = false, continueOnError = true } = {}) {
    if (state !== ORCHESTRATOR_STATES.idle && state !== ORCHESTRATOR_STATES.completed && state !== ORCHESTRATOR_STATES.cancelled && state !== ORCHESTRATOR_STATES.failed) {
      throw new Error(`Cannot start agent loop in state ${state}`);
    }

    retryCount = 0;
    errorHistory = [];

    await startTask({ title, description, context });
    if (state === ORCHESTRATOR_STATES.failed) return getSnapshot();
    if (state === ORCHESTRATOR_STATES.cancelled) return getSnapshot();

    if (!autoApprove && state === ORCHESTRATOR_STATES.awaitingApproval) {
      return getSnapshot();
    }

    if (state === ORCHESTRATOR_STATES.awaitingApproval) {
      approvePlan();
    }

    const steps = plan && Array.isArray(plan.steps) ? plan.steps : [];
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;

    for (let i = 0; i < steps.length && i < maxSteps; i++) {
      ensureNotCancelled();
      if (state === ORCHESTRATOR_STATES.cancelled) break;

      if (state === ORCHESTRATOR_STATES.failed && continueOnError) {
        state = ORCHESTRATOR_STATES.executing;
        emit();
      }

      const step = steps[i];
      const toolToUse = step.expectedTools && step.expectedTools.length > 0
        ? step.expectedTools[0]
        : "ide.read-file";

      const args = step.expectedFiles && step.expectedFiles.length > 0
        ? { path: step.expectedFiles[0] }
        : {};

      try {
        const obs = await executeStep({ toolName: toolToUse, args }, execFn);
        consecutiveFailures = 0;
        if (typeof onStepComplete === "function") {
          onStepComplete({ step, observation: obs, index: i, total: steps.length });
        }
      } catch (error) {
        consecutiveFailures++;
        retryCount++;

        if (typeof onStepComplete === "function") {
          onStepComplete({
            step,
            observation: { tool: toolToUse, status: "error", error: error.message },
            index: i,
            total: steps.length,
            failed: true,
          });
        }

        if (!continueOnError || consecutiveFailures >= maxConsecutiveFailures) {
          break;
        }
      }
    }

    const successfulObs = observations.filter((obs) => obs.status === "success");
    const failedObs = observations.filter((obs) => obs.status === "error");

    if (successfulObs.length > 0 || (state === ORCHESTRATOR_STATES.executing || state === ORCHESTRATOR_STATES.observing)) {
      const generatedChangeset = observationsToChangeset({
        title: `Agent changeset: ${title || "task"}`,
        observations: successfulObs,
      });

      if (generatedChangeset) {
        generatedChangeset.metadata = {
          totalSteps: steps.length,
          successfulSteps: successfulObs.length,
          failedSteps: failedObs.length,
          retryCount,
          errorHistory: errorHistory.slice(-10),
        };
        changeset = generatedChangeset;
        state = ORCHESTRATOR_STATES.changesProposed;
        taskSession.setState(TASK_STATES.observing);
        state = ORCHESTRATOR_STATES.awaitingReview;
        emit();
      } else {
        state = ORCHESTRATOR_STATES.awaitingReview;
        emit();
      }
    } else if (state === ORCHESTRATOR_STATES.failed && observations.length > 0) {
      state = ORCHESTRATOR_STATES.awaitingReview;
      emit();
    }

    return getSnapshot();
  }

  function getErrorHistory() {
    return [...errorHistory];
  }

  function getRetryCount() {
    return retryCount;
  }

  return {
    getSnapshot,
    subscribe,
    startTask,
    approvePlan,
    rejectPlan,
    executeStep,
    executeStepWithRetry,
    proposeChangeset,
    complete,
    cancel,
    fail,
    runAgentLoop,
    getErrorHistory,
    getRetryCount,
  };
}
