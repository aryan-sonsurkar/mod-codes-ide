"use client";
import { createContextRequest, selectContext } from "../ai/contextIntelligence";

export const LIFECYCLE_STATES = {
  idle: "idle",
  preparing: "preparing",
  inspecting: "inspecting",
  contextReady: "contextReady",
  planning: "planning",
  awaitingApproval: "awaitingApproval",
  executing: "executing",
  validation: "validation",
  review: "review",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
  blocked: "blocked",
};

function hasDependencyCheck() {
  return false;
}

export function createProjectLifecycleOrchestrator({
  agentOrchestrator,
  inspectCodebase: inspectFn,
  gitSafetyLevel,
} = {}) {
  if (!agentOrchestrator || typeof agentOrchestrator.getSnapshot !== "function") {
    throw new Error("agentOrchestrator required");
  }

  let state = LIFECYCLE_STATES.idle;
  let milestone = null;
  let projectData = null;
  let inspectionResult = null;
  let contextSelection = null;
  let proposedMemoryUpdate = null;
  let error = null;
  let agentUnsub = null;
  const listeners = new Set();

  function emit() {
    const snap = getSnapshot();
    for (const l of listeners) l(snap);
  }

  function getSnapshot() {
    return {
      state,
      milestone,
      projectData,
      inspectionResult,
      contextSelection,
      proposedMemoryUpdate,
      error,
      agentState: agentOrchestrator.getSnapshot ? agentOrchestrator.getSnapshot().state : null,
      // agent and lifecycle states are distinct
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setState(next, nextError = null) {
    state = next;
    error = nextError;
    emit();
  }

  // Subscribe to agent to drive lifecycle transitions without polling
  agentUnsub = agentOrchestrator.subscribe((agentSnap) => {
    // Map agent states to lifecycle
    if (state === LIFECYCLE_STATES.executing && (agentSnap.state === "observing" || agentSnap.state === "executing")) {
      // stay executing — agent is working
      emit();
    }
    if (state === LIFECYCLE_STATES.executing && (agentSnap.state === "changesProposed" || agentSnap.state === "awaitingReview")) {
      state = LIFECYCLE_STATES.validation;
      emit();
      state = LIFECYCLE_STATES.review;
      // Prepare proposed memory update — not silent write
      if (milestone) {
        proposedMemoryUpdate = {
          section: "Progress",
          append: `\n- ${milestone.id} ${milestone.goal || milestone.title}: ready_for_review (${new Date().toISOString()})`,
          milestoneId: milestone.id,
          requires: ["Accept", "Edit", "Reject"],
        };
      }
      emit();
    }
    if (agentSnap.state === "completed" && state === LIFECYCLE_STATES.review) {
      // lifecycle will move to completed only after review + save gate (via complete())
      emit();
    }
    if (agentSnap.state === "cancelled" && state !== LIFECYCLE_STATES.cancelled) {
      state = LIFECYCLE_STATES.cancelled;
      emit();
    }
    if (agentSnap.state === "failed" && state !== LIFECYCLE_STATES.failed) {
      state = LIFECYCLE_STATES.failed;
      error = agentSnap.task?.error || "Agent failed";
      emit();
    }
  });

  async function startMilestone({ milestone: incoming, modcodesData, tree, fileContents, roadmapMilestones } = {}) {
    // Validation boundaries
    if (!incoming || !incoming.id) {
      setState(LIFECYCLE_STATES.failed, "Milestone not found — return to roadmap");
      return getSnapshot();
    }
    if (!modcodesData) {
      setState(LIFECYCLE_STATES.blocked, "Project memory unavailable — ensure .modcodes exists");
      return getSnapshot();
    }
    // Validate milestone exists in roadmap if provided
    if (Array.isArray(roadmapMilestones) && roadmapMilestones.length) {
      const exists = roadmapMilestones.some((m) => m.id === incoming.id);
      if (!exists) {
        setState(LIFECYCLE_STATES.failed, `Milestone ${incoming.id} not found in roadmap`);
        return getSnapshot();
      }
    }

    milestone = incoming;
    projectData = modcodesData;
    inspectionResult = null;
    contextSelection = null;
    proposedMemoryUpdate = null;
    error = null;
    setState(LIFECYCLE_STATES.preparing);

    // Git safety surface (read-only, no auto-commit)
    if (typeof gitSafetyLevel === "function") {
      try {
        const level = gitSafetyLevel({ hasUncommitted: false, affectedOverlap: false, isLargeTask: (incoming.tasks||[]).length > 5, isDestructive: false });
        // level surfaced via inspectionResult, not enforced as block
        inspectionResult = { gitSafety: level };
      } catch {}
    }

    // Inspect relevant project state using existing inspection infrastructure
    if (inspectFn) {
      setState(LIFECYCLE_STATES.inspecting);
      try {
        const result = await inspectFn({ tree, fileContents });
        inspectionResult = { ...(inspectionResult || {}), ...result };
      } catch (e) {
        setState(LIFECYCLE_STATES.failed, `Inspection failed: ${e && e.message ? e.message : String(e)} — retry`);
        return getSnapshot();
      }
    }

    setState(LIFECYCLE_STATES.contextReady);

    // Context Intelligence — relevant, bounded, explainable, safe (M154)
    let context = {
      milestone,
      project: projectData.project,
      inspection: inspectionResult,
    };
    try {
      const taskText = `${milestone.title || milestone.goal || milestone.id} ${Array.isArray(milestone.tasks) ? milestone.tasks.join(" ") : ""}`;
      const request = createContextRequest({ task: taskText, milestone, project: projectData.project, phase: projectData.project.phase, budget: 24000 });
      const selection = selectContext(request, { projectData, tree, fileContents });
      contextSelection = selection;
      context = {
        milestone,
        project: projectData.project,
        inspection: inspectionResult,
        contextSelection: selection,
        // Backward-compatible slices for planner that expects prd/arch/decisions
        prd: projectData.sections?.PRD ? String(projectData.sections.PRD).slice(0, 800) : null,
        architecture: selection.selected.find((s)=>s.type==="architecture")?.content || null,
        decisions: selection.selected.filter((s)=>s.type==="decision").map((s)=>s.content).join("\n").slice(0, 800) || null,
        evidence: selection.selected.filter((s)=>s.type==="research").map((s)=>s.content).slice(0,4),
      };
    } catch {
      // fallback to previous naive context if intelligence fails
      context = {
        milestone,
        project: projectData.project,
        prd: projectData.sections?.PRD ? String(projectData.sections.PRD).slice(0, 2000) : null,
        architecture: projectData.sections?.Architecture ? String(projectData.sections.Architecture).slice(0, 1000) : null,
        decisions: projectData.sections?.Decisions ? String(projectData.sections.Decisions).slice(0, 1000) : null,
        openQuestions: projectData.sections?.["Open Questions"] ? String(projectData.sections["Open Questions"]).slice(0, 800) : null,
        inspection: inspectionResult,
      };
    }

    // Create development task via existing agentOrchestrator + planner
    setState(LIFECYCLE_STATES.planning);
    try {
      const title = milestone.title || milestone.goal || milestone.id;
      const description = Array.isArray(milestone.tasks) ? milestone.tasks.join(", ") : String(milestone.goal || "");
      await agentOrchestrator.startTask({ title, description, context });
      // agentOrchestrator will transition to awaitingApproval via its own planner
      // Mirror that here — poll snapshot once (subscription will keep sync)
      const agentSnap = agentOrchestrator.getSnapshot();
      if (agentSnap.state === "awaitingApproval" || agentSnap.state === "planReady") {
        setState(LIFECYCLE_STATES.awaitingApproval);
      } else if (agentSnap.state === "failed") {
        setState(LIFECYCLE_STATES.failed, agentSnap.task?.error || "Planner failed — retry/cancel");
      }
    } catch (e) {
      setState(LIFECYCLE_STATES.failed, e && e.message ? e.message : "Planner failed");
    }
    return getSnapshot();
  }

  function approvePlan() {
    if (state !== LIFECYCLE_STATES.awaitingApproval) {
      throw new Error(`Cannot approve in lifecycle state ${state} — approval required before execution`);
    }
    // Approval gate — delegate to agent
    agentOrchestrator.approvePlan();
    setState(LIFECYCLE_STATES.executing);
    return getSnapshot();
  }

  function pause() {
    // agent has no pause — we treat as no-op but keep lifecycle executing
    // Do not bypass cancellation mechanism
    return getSnapshot();
  }

  function resume() {
    return getSnapshot();
  }

  function cancel() {
    agentOrchestrator.cancel();
    setState(LIFECYCLE_STATES.cancelled);
    return getSnapshot();
  }

  function reviewChanges() {
    if (state !== LIFECYCLE_STATES.review && state !== LIFECYCLE_STATES.validation) {
      throw new Error(`Cannot review in state ${state}`);
    }
    // Changeset remains reviewable — Save Gate controls persistence
    setState(LIFECYCLE_STATES.review);
    return getSnapshot();
  }

  function complete() {
    // Only allow completed when agent has produced changeset and user reviewed
    // Do NOT auto-complete, do NOT silently mutate .modcodes
    if (state !== LIFECYCLE_STATES.review && state !== LIFECYCLE_STATES.validation) {
      throw new Error(`Cannot complete in state ${state} — review required`);
    }
    setState(LIFECYCLE_STATES.completed);
    return getSnapshot();
  }

  function fail(reason) {
    setState(LIFECYCLE_STATES.failed, reason || "Failed");
    try { agentOrchestrator.fail(reason); } catch {}
    return getSnapshot();
  }

  if (hasDependencyCheck()) {
    throw new Error("Lifecycle dependency violation");
  }

  return {
    getSnapshot,
    subscribe,
    startMilestone,
    approvePlan,
    pause,
    resume,
    cancel,
    reviewChanges,
    complete,
    fail,
    states: LIFECYCLE_STATES,
  };
}
