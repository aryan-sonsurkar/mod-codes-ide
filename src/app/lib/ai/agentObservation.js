export function createObservation({ tool, args = {}, result, status = "success", durationMs = 0, stepId = null, observation = null } = {}) {
  if (!tool || typeof tool !== "string") {
    throw new TypeError("Observation tool is required");
  }
  const concise = typeof observation === "string" ? observation.slice(0, 800) : null;
  const resultText = typeof result === "string" ? result.slice(0, 8000) : JSON.stringify(result || "").slice(0, 8000);
  return {
    tool,
    arguments: args && typeof args === "object" ? args : {},
    result: resultText,
    status: status === "error" ? "error" : "success",
    durationMs: Number.isFinite(durationMs) ? durationMs : 0,
    stepId: typeof stepId === "string" ? stepId : null,
    observation: concise || inferObservation(tool, resultText, status),
    timestamp: Date.now(),
  };
}

function inferObservation(tool, resultText, status) {
  if (status === "error") {
    return `${tool} failed`;
  }
  if (tool === "ide.diagnostics" && resultText) {
    return `Found diagnostics (${resultText.slice(0, 120)})`;
  }
  if (tool === "ide.current-file" && resultText) {
    return `Read file (${Math.min(resultText.length, 8000)} chars)`;
  }
  if (tool === "ide.open-files") {
    return "Listed open files";
  }
  return `${tool} completed`;
}

export function summarizeObservations(observations = []) {
  return observations.map((o) => `${o.tool}: ${o.observation} (${o.durationMs}ms)`).join("\n");
}
