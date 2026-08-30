"use client";

// Detect concurrent user/agent edits on same file.
export function detectConcurrentEdits({ userEditedPaths, agentChangeset }) {
  const agentPaths = new Set((agentChangeset?.changes || []).map((c) => c.path));
  const conflicts = [];
  for (const p of userEditedPaths || []) {
    if (agentPaths.has(p)) conflicts.push(p);
  }
  return conflicts;
}

export function concurrentMessage(conflicts) {
  if (!conflicts || conflicts.length === 0) return null;
  return `⚠ File changed by you while the agent was working: ${conflicts.join(", ")} — Options: Review / Keep mine / Keep agent version / Merge. Prefer preserving user changes.`;
}
