import { createAgentStep } from "./agentTask";

const KNOWN_TOOLS = new Set(["ide.current-file", "ide.open-files", "ide.diagnostics", "ide.search"]);

function validateStep(step, index) {
  if (!step || typeof step.title !== "string" || step.title.length === 0) {
    throw new TypeError(`Step ${index} requires a title`);
  }
  if (step.expectedTools) {
    for (const tool of step.expectedTools) {
      if (!KNOWN_TOOLS.has(tool)) {
        throw new TypeError(`Step ${index} uses unknown tool: ${tool}`);
      }
    }
  }
  if (step.expectedFiles) {
    for (const path of step.expectedFiles) {
      if (typeof path !== "string" || path.length === 0) {
        throw new TypeError(`Step ${index} has invalid path`);
      }
    }
  }
}

function validatePlan(plan, bounds) {
  if (!plan || !Array.isArray(plan.steps)) {
    throw new TypeError("Plan must have steps array");
  }
  if (plan.steps.length === 0) {
    throw new TypeError("Plan must have at least one step");
  }
  if (plan.steps.length > bounds.maxSteps) {
    throw new TypeError(`Plan exceeds maxSteps ${bounds.maxSteps}`);
  }
  plan.steps.forEach(validateStep);
  return plan;
}

export function createPlanner({ maxSteps = 10 } = {}) {
  return async function plan({ title, description, context, signal, bounds } = {}) {
    if (signal && signal.aborted) {
      throw new Error("Planning cancelled");
    }
    const lower = (title || "").toLowerCase();
    const steps = [];

    if (lower.includes("bug") || lower.includes("fix")) {
      steps.push(
        createAgentStep({ title: "Inspect project structure", reason: "Understand layout before fixing", expectedTools: ["ide.open-files"], expectedFiles: [], risk: "low" }),
        createAgentStep({ title: "Inspect diagnostics", reason: "Find reported errors", expectedTools: ["ide.diagnostics"], expectedFiles: [], risk: "low" }),
        createAgentStep({ title: "Propose fix", reason: "Generate changeset for review", expectedTools: ["ide.current-file"], expectedFiles: context && context.currentFile ? [context.currentFile.path] : [], risk: "medium" })
      );
    } else if (lower.includes("auth")) {
      steps.push(
        createAgentStep({ title: "Inspect project structure", reason: "Find routes", expectedTools: ["ide.open-files"], risk: "low" }),
        createAgentStep({ title: "Inspect dependencies", reason: "Check auth libs", expectedTools: ["ide.current-file"], risk: "low" }),
        createAgentStep({ title: "Propose changes", reason: "Draft changeset", expectedTools: ["ide.current-file"], risk: "medium" })
      );
    } else {
      steps.push(
        createAgentStep({ title: "Read current file", reason: "Gather context", expectedTools: ["ide.current-file"], expectedFiles: context && context.currentFile ? [context.currentFile.path] : [], risk: "low" }),
        createAgentStep({ title: "Search workspace", reason: "Find relevant files", expectedTools: ["ide.open-files"], risk: "low" }),
        createAgentStep({ title: "Propose changes", reason: "Prepare changeset for approval", expectedTools: ["ide.current-file"], risk: "low" })
      );
    }

    const plan = { id: `plan-${Date.now()}`, title, description: description || null, steps: steps.slice(0, maxSteps) };
    return validatePlan(plan, { maxSteps: bounds ? bounds.maxSteps || maxSteps : maxSteps });
  };
}

export function validateAgentPlan(plan, bounds = { maxSteps: 10 }) {
  return validatePlan(plan, bounds);
}
