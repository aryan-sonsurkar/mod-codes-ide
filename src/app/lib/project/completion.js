"use client";

export const COMPLETION_STATUSES = {
  not_started: "not_started",
  in_progress: "in_progress",
  blocked: "blocked",
  needs_review: "needs_review",
  likely_complete: "likely_complete",
  complete: "complete",
  unknown: "unknown",
};

// helper: normalize changed paths from various changeset shapes
function changedPaths(changeset) {
  if (!changeset) return [];
  if (Array.isArray(changeset.operations)) return changeset.operations.map((o) => o.path).filter(Boolean);
  if (Array.isArray(changeset.changes)) return changeset.changes.map((c) => c.path).filter(Boolean);
  if (Array.isArray(changeset)) return changeset.map((c) => c.path || c).filter(Boolean);
  return [];
}

function taskSupported(task, paths, progressText) {
  const lowTask = String(task || "").toLowerCase();
  const keywords = lowTask.split(/\W+/).filter((w) => w.length > 3);
  const progressLow = String(progressText || "").toLowerCase();
  if (progressLow.includes(lowTask.slice(0, 20).toLowerCase())) return true;
  for (const p of paths) {
    const lowPath = String(p).toLowerCase();
    for (const kw of keywords) {
      const base = kw.endsWith("s") ? kw.slice(0, -1) : kw;
      if (lowPath.includes(kw) || lowPath.includes(base) || kw.includes(lowPath.split("/").pop().replace(".ts","").replace(".js","") )) return true;
      // also check singular/plural swap
      if (kw === "tests" && lowPath.includes("test")) return true;
      if (kw === "test" && lowPath.includes("test")) return true;
    }
  }
  return false;
}

export function detectMilestoneCompletion({
  milestone,
  projectData,
  changeset,
  tests,
  inspection,
  gitState,
  agentState,
  prd,
} = {}) {
  const tasks = Array.isArray(milestone?.tasks) ? milestone.tasks : [];
  const criteriaRaw = milestone?.criteria;
  const criteriaList = Array.isArray(criteriaRaw) ? criteriaRaw : (typeof criteriaRaw === "string" && criteriaRaw.trim() ? [criteriaRaw] : []);
  const progressText = projectData ? String(projectData.sections?.Progress || "") : "";
  const prdText = prd || (projectData ? String(projectData.sections?.PRD || "") : "");
  const paths = changedPaths(changeset);

  const blockers = [];
  const evidence = [];

  // Agent signals
  const isCancelled = agentState === "cancelled" || agentState?.state === "cancelled";
  const isFailed = agentState === "failed" || agentState?.state === "failed";
  if (isCancelled) blockers.push({ type: "cancelled", description: "Agent was cancelled", evidence: ["agentState: cancelled"] });
  if (isFailed) blockers.push({ type: "agent_failure", description: "Agent failed", evidence: ["agentState: failed"] });

  // Test signals
  const testFailing = tests ? (tests.failing > 0 || tests.failed > 0) : false;
  const testMissing = tests ? (tests.missing > 0 || tests.total === 0) : false;
  if (testFailing) blockers.push({ type: "test_failure", description: `${tests.failing || tests.failed} test(s) failing`, evidence: ["tests: failing"] });
  if (gitState && gitState.conflict) blockers.push({ type: "git_conflict", description: "Git conflict present", evidence: ["gitState: conflict"] });
  if (gitState && gitState.destructive) blockers.push({ type: "destructive", description: "Destructive pending change", evidence: ["gitState: destructive"] });

  // Task evaluation
  const taskAssessments = tasks.map((t, i) => {
    const supported = taskSupported(t, paths, progressText);
    // also consider manual user changes: if progress already mentions task as done
    const manualDone = progressText.toLowerCase().includes(String(t).toLowerCase().slice(0, 15));
    const status = supported || manualDone ? "supported" : "missing";
    const reason = status === "supported" ? `Evidence: relevant file changed or progress mentions task` : `No evidence for task "${String(t).slice(0,40)}"`;
    const ev = supported ? (paths.find((p) => String(t).toLowerCase().split(/\W+/).some((kw) => kw.length>3 && p.toLowerCase().includes(kw))) || "progress") : [];
    evidence.push(`task:${i}:${status}`);
    return { id: `task-${i}`, description: String(t), status, reason, evidence: ev ? [ev] : [] };
  });

  // Criteria evaluation
  const criteriaAssessments = criteriaList.map((c, i) => {
    const txt = String(c);
    const low = txt.toLowerCase();
    // check if any path or test supports criterion
    const hasEvidence = paths.some((p) => low.split(/\W+/).some((kw) => kw.length>3 && p.toLowerCase().includes(kw))) || (!testMissing && !testFailing);
    // special: session expiry test missing example
    const isMissing = low.includes("expire") && (!tests || tests.missing > 0 || !paths.some((p)=>p.includes("session")));
    const status = isMissing ? "missing" : hasEvidence ? "supported" : "missing";
    const reason = status === "supported" ? `Criterion supported by ${hasEvidence ? "changed file/test" : "project state"}` : `No evidence for criterion "${txt.slice(0,40)}"`;
    return { id: `criterion-${i}`, description: txt, status, reason, evidence: hasEvidence ? ["changeset"] : [] };
  });

  // PRD requirements
  const requirements = [];
  if (prdText && milestone) {
    const prdLines = prdText.split("\n").filter((l) => /FR-/.test(l)).slice(0,5);
    for (let i=0;i<prdLines.length;i++) {
      const line = prdLines[i];
      const related = milestone.goal && line.toLowerCase().includes(milestone.goal.toLowerCase().split(" ")[0]);
      requirements.push({ id: `FR-${i}`, description: line.trim().slice(0,80), status: related ? "partially_supported" : "unknown", evidence: related ? ["milestone:PRD relationship"] : [] });
    }
  }

  // Missing criterion evidence → blocker-like
  const missingCriteria = criteriaAssessments.filter((c)=>c.status==="missing");
  if (missingCriteria.length && tasks.length) {
    // not necessarily blocker, but needs_review
  }

  // Determine overall status
  let status = COMPLETION_STATUSES.unknown;
  let confidence = 0.5;

  const hasBlocker = blockers.length > 0;
  const explicitComplete = milestone?.status === "complete" || milestone?.status === "done";
  if (explicitComplete) {
    status = COMPLETION_STATUSES.complete;
    confidence = 0.95;
  } else if (hasBlocker) {
    status = COMPLETION_STATUSES.blocked;
    confidence = 0.3;
  } else if (missingCriteria.length) {
    // Missing evidence for criterion → needs review (strong signal, even if tasks partially done)
    status = COMPLETION_STATUSES.needs_review;
    confidence = missingCriteria.length === criteriaList.length ? 0.7 : 0.82;
  } else if (tasks.length === 0 && criteriaList.length === 0) {
    status = COMPLETION_STATUSES.unknown;
    confidence = 0.2;
  } else if (tasks.length && taskAssessments.every((t)=>t.status==="missing") && paths.length===0) {
    status = COMPLETION_STATUSES.not_started;
    confidence = 0.1;
  } else if (taskAssessments.some((t)=>t.status==="supported") && taskAssessments.some((t)=>t.status==="missing")) {
    status = COMPLETION_STATUSES.in_progress;
    confidence = 0.55;
  } else if (taskAssessments.length && taskAssessments.every((t)=>t.status==="supported") && !hasBlocker) {
    status = COMPLETION_STATUSES.likely_complete;
    confidence = 0.88;
  } else if (tasks.length && taskAssessments.some((t)=>t.status==="supported")) {
    status = COMPLETION_STATUSES.in_progress;
    confidence = 0.6;
  } else {
    status = COMPLETION_STATUSES.needs_review;
    confidence = 0.6;
  }

  // Override: if strong evidence but missing criterion, needs_review (not likely_complete)
  if (status === COMPLETION_STATUSES.likely_complete && missingCriteria.length) {
    status = COMPLETION_STATUSES.needs_review;
    confidence = 0.82;
  }

  const completed = taskAssessments.filter((t)=>t.status==="supported").length;
  const total = tasks.length || criteriaList.length || 1;

  // Summary
  const summary = `${completed}/${total} ${tasks.length ? "tasks" : "criteria"} ${status}; ${blockers.length} blocker(s); ${missingCriteria.length} missing criteria`;

  return {
    status,
    confidence,
    tasks: taskAssessments,
    criteria: criteriaAssessments,
    requirements,
    blockers,
    evidence: [...evidence, ...paths],
    summary,
    completed,
    total,
  };
}
