import { createAgentStep } from "./agentTask";

const PLAN_SYSTEM_PROMPT =
  "You are a planning agent. Given a task description and project context, " +
  "produce a JSON plan with steps to accomplish the task. " +
  "Each step must have: title (string), reason (string), expectedTools (array of tool IDs), " +
  "risk (one of: low, medium, high). " +
  "Available tools: ide.current-file, ide.open-files, ide.diagnostics, ide.search, " +
  "ide.read-file, ide.write-file, ide.apply-patch, ide.create-file. " +
  "Return ONLY valid JSON with this structure: { \"steps\": [...] }. " +
  "Keep the plan concise — 3 to 8 steps. Prefer read tools first, then write tools.";

const ALL_KNOWN_TOOLS = new Set([
  "ide.current-file", "ide.open-files", "ide.diagnostics", "ide.search",
  "ide.read-file", "ide.write-file", "ide.apply-patch", "ide.create-file",
]);

function validateStep(step, index) {
  if (!step || typeof step.title !== "string" || step.title.length === 0) {
    throw new TypeError(`Step ${index} requires a title`);
  }
  if (step.expectedTools) {
    for (const tool of step.expectedTools) {
      if (!ALL_KNOWN_TOOLS.has(tool)) {
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

function fallbackPlan(title, description) {
  const lower = (title || "").toLowerCase();
  const steps = [];

  if (lower.includes("bug") || lower.includes("fix")) {
    steps.push(
      createAgentStep({ title: "Inspect project structure", reason: "Understand layout before fixing", expectedTools: ["ide.open-files"], expectedFiles: [], risk: "low" }),
      createAgentStep({ title: "Inspect diagnostics", reason: "Find reported errors", expectedTools: ["ide.diagnostics"], expectedFiles: [], risk: "low" }),
      createAgentStep({ title: "Read relevant files", reason: "Examine the code with issues", expectedTools: ["ide.read-file"], risk: "low" }),
      createAgentStep({ title: "Propose fix", reason: "Generate changeset for review", expectedTools: ["ide.apply-patch"], expectedFiles: [], risk: "medium" })
    );
  } else if (lower.includes("add") || lower.includes("create") || lower.includes("implement")) {
    steps.push(
      createAgentStep({ title: "Understand project structure", reason: "See existing patterns", expectedTools: ["ide.open-files"], risk: "low" }),
      createAgentStep({ title: "Search for similar code", reason: "Find reference implementations", expectedTools: ["ide.search"], risk: "low" }),
      createAgentStep({ title: "Read existing files", reason: "Understand conventions", expectedTools: ["ide.read-file"], risk: "low" }),
      createAgentStep({ title: "Implement changes", reason: "Create or modify files", expectedTools: ["ide.write-file"], risk: "high" })
    );
  } else {
    steps.push(
      createAgentStep({ title: "Read current file", reason: "Gather context", expectedTools: ["ide.current-file"], risk: "low" }),
      createAgentStep({ title: "Search workspace", reason: "Find relevant files", expectedTools: ["ide.search"], risk: "low" }),
      createAgentStep({ title: "Read related files", reason: "Deepen understanding", expectedTools: ["ide.read-file"], risk: "low" }),
      createAgentStep({ title: "Propose changes", reason: "Prepare changeset for approval", expectedTools: ["ide.apply-patch"], risk: "medium" })
    );
  }

  return steps;
}

function parsePlanFromResponse(text) {
  if (!text || typeof text !== "string") return null;

  const jsonMatch = text.match(/\{[\s\S]*"steps"[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && Array.isArray(parsed.steps)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function createPlanner({ maxSteps = 10, provider = null, model = null } = {}) {
  return async function plan({ title, description, context, signal, bounds } = {}) {
    if (signal && signal.aborted) {
      throw new Error("Planning cancelled");
    }

    let steps = [];

    if (provider && typeof provider.chat === "function" && model) {
      try {
        const contextSnippet = context
          ? `Open files: ${(context.openDocuments || []).map(d => typeof d === "string" ? d : d.path || "").join(", ")}`
          : "No context provided.";

        const prompt =
          `Task: ${title}\n` +
          (description ? `Description: ${description}\n` : "") +
          `${contextSnippet}\n\n` +
          "Produce a JSON plan with steps to accomplish this task.";

        const result = await provider.chat({
          messages: [
            { role: "system", content: PLAN_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          model,
          options: { temperature: 0.2 },
        });

        if (result && result.ok && result.text) {
          const parsed = parsePlanFromResponse(result.text);
          if (parsed && parsed.steps.length > 0) {
            steps = parsed.steps.slice(0, maxSteps).map((s, i) =>
              createAgentStep({
                title: s.title || `Step ${i + 1}`,
                reason: s.reason || "",
                expectedTools: Array.isArray(s.expectedTools) ? s.expectedTools : [],
                expectedFiles: Array.isArray(s.expectedFiles) ? s.expectedFiles : [],
                risk: ["low", "medium", "high"].includes(s.risk) ? s.risk : "low",
              })
            );
          }
        }
      } catch {
        // Fall through to fallback
      }
    }

    if (steps.length === 0) {
      steps = fallbackPlan(title, description);
    }

    const plan = {
      id: `plan-${Date.now()}`,
      title,
      description: description || null,
      steps: steps.slice(0, maxSteps),
    };

    return validatePlan(plan, { maxSteps: bounds ? bounds.maxSteps || maxSteps : maxSteps });
  };
}

export function validateAgentPlan(plan, bounds = { maxSteps: 10 }) {
  return validatePlan(plan, bounds);
}
