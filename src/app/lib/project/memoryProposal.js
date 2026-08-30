"use client";
import { CANONICAL_SECTIONS, getSection, setSection } from "./modcodes";

export const PROPOSAL_STATUSES = {
  pending: "pending",
  accepted: "accepted",
  edited: "edited",
  rejected: "rejected",
  saved: "saved",
  failed: "failed",
};

export const PROPOSAL_OPERATIONS = {
  append: "append",
  update: "update",
  remove: "remove",
};

const SECRET_VALUE_PATTERNS = [
  /DATABASE_URL\s*=\s*.+/i,
  /api[_-]?key\s*[:=]\s*.+/i,
  /password\s*[:=]\s*.+/i,
  /secret\s*[:=]\s*.+/i,
  /token\s*[:=]\s*.+/i,
  /BEGIN PRIVATE KEY/i,
  /BEGIN RSA PRIVATE KEY/i,
];

function containsSecretValue(text) {
  const t = String(text || "");
  return SECRET_VALUE_PATTERNS.some((re) => re.test(t));
}

function isValidSection(section) {
  return CANONICAL_SECTIONS.includes(String(section || "").trim());
}

function isValidMarkdown(text) {
  // basic: no malformed heading without space, no duplicate invalid entries check is lightweight
  const t = String(text || "");
  if (t.includes("#") && /#\S/.test(t)) {
    // heading without space like "#Invalid" — we consider invalid
    // but allow "# Project" etc.
    // check for "#\w" without space
    if (/#[^ \n#]/.test(t) && !/^#\s/m.test(t)) return false;
  }
  return true;
}

export function createMemoryProposal({
  section = "Progress",
  operation = PROPOSAL_OPERATIONS.append,
  before = "",
  after = "",
  reason = "",
  evidence = [],
  milestoneId = null,
} = {}) {
  if (!isValidSection(section)) throw new Error(`Invalid section: ${section}`);
  if (!Object.values(PROPOSAL_OPERATIONS).includes(operation)) throw new Error(`Invalid operation: ${operation}`);
  const now = new Date().toISOString();
  return {
    id: `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
    section: String(section).trim(),
    operation,
    before: String(before || ""),
    after: String(after || ""),
    reason: String(reason || ""),
    evidence: Array.isArray(evidence) ? evidence.slice(0,5) : [],
    requires: ["Accept", "Edit", "Reject"],
    status: PROPOSAL_STATUSES.pending,
    createdAt: now,
    milestoneId,
    beforeHash: String(before || ""),
  };
}

export function createProgressProposal({ milestone, verification, projectData } = {}) {
  if (!milestone || !milestone.id) throw new Error("milestone required");
  const status = verification?.status;
  // Only propose completion-related Progress when verified; otherwise propose appropriate note
  let afterSnippet = "";
  let reason = "";
  if (status === "verified") {
    afterSnippet = `- ${milestone.id} ${milestone.goal || milestone.title}: verified (${new Date().toISOString().split("T")[0]})`;
    reason = `Milestone ${milestone.id} verified`;
  } else if (status === "failed") {
    afterSnippet = `- ${milestone.id} verification failed: ${verification?.criteria?.find((c)=>c.status==="failed")?.description?.slice(0,60) || "criterion failed"}`;
    reason = `Milestone ${milestone.id} verification failed`;
  } else if (status === "partially_verified") {
    afterSnippet = `- ${milestone.id} partially verified: ${verification.passed}/${verification.criteria.length} criteria passed`;
    reason = `Milestone ${milestone.id} partially verified`;
  } else if (status === "blocked") {
    afterSnippet = `- ${milestone.id} verification blocked: ${verification?.blockers?.[0]?.description || "blocked"}`;
    reason = `Milestone ${milestone.id} verification blocked`;
  } else if (status === "unknown") {
    return null; // avoid noise
  } else {
    // for needs_review etc., don't auto-propose completion
    return null;
  }

  const before = String(projectData ? getSection(projectData, "Progress") || "" : "");
  // Duplicate detection — idempotent
  if (before.includes(afterSnippet) || before.includes(`${milestone.id} ${milestone.goal || milestone.title}: verified`)) {
    return null;
  }

  const evidence = verification && Array.isArray(verification.criteria) ? verification.criteria.slice(0,3).map((c)=>String(c.description||c).slice(0,40)) : [];
  const beforeForProposal = before;
  const after = before ? `${before.trim()}\n${afterSnippet}` : afterSnippet;

  return createMemoryProposal({
    section: "Progress",
    operation: PROPOSAL_OPERATIONS.append,
    before: beforeForProposal,
    after,
    reason,
    evidence,
    milestoneId: milestone.id,
  });
}

export function validateProposal(proposal, projectData) {
  if (!proposal || typeof proposal !== "object") return { ok: false, reason: "invalid proposal" };
  if (!isValidSection(proposal.section)) return { ok: false, reason: `invalid section ${proposal.section}` };
  if (!Object.values(PROPOSAL_OPERATIONS).includes(proposal.operation)) return { ok: false, reason: "invalid operation" };
  if (containsSecretValue(proposal.after)) return { ok: false, reason: "secret value detected" };
  if (!isValidMarkdown(proposal.after)) return { ok: false, reason: "malformed Markdown" };
  if (proposal.after.length > 50000) return { ok: false, reason: "content too large" };
  // Check .modcodes format version still valid via projectData presence
  if (!projectData || !projectData.project) return { ok: false, reason: "missing projectData" };
  return { ok: true };
}

export function isDuplicateProposal(proposal, projectData) {
  if (!proposal || !projectData) return false;
  const current = String(getSection(projectData, proposal.section) || "");
  return current.includes(proposal.after.trim().split("\n").pop().trim());
}

export function detectConcurrentModification(proposal, currentProjectData) {
  if (!proposal || !currentProjectData) return false;
  // compare beforeHash with current section content
  const current = String(getSection(currentProjectData, proposal.section) || "");
  return current !== proposal.before;
}

export function acceptProposal(proposal) {
  if (!proposal || proposal.status !== PROPOSAL_STATUSES.pending) throw new Error("Can only accept pending proposal");
  return { ...proposal, status: PROPOSAL_STATUSES.accepted };
}

export function editProposal(proposal, newAfter) {
  if (!proposal || proposal.status !== PROPOSAL_STATUSES.pending) throw new Error("Can only edit pending proposal");
  if (containsSecretValue(newAfter)) throw new Error("secret value detected in edited content");
  return { ...proposal, after: String(newAfter), status: PROPOSAL_STATUSES.edited };
}

export function rejectProposal(proposal) {
  if (!proposal || proposal.status !== PROPOSAL_STATUSES.pending) throw new Error("Can only reject pending proposal");
  return { ...proposal, status: PROPOSAL_STATUSES.rejected };
}

// Apply via Save Gate — must be called only after Accept/Edit and validation
export async function applyProposalViaSaveGate({ proposal, projectData, saveModcodes, rootName }) {
  if (!proposal || (proposal.status !== PROPOSAL_STATUSES.accepted && proposal.status !== PROPOSAL_STATUSES.edited)) {
    return { ok: false, reason: "proposal not accepted/edited" };
  }
  const validation = validateProposal(proposal, projectData);
  if (!validation.ok) return { ok: false, reason: validation.reason, status: PROPOSAL_STATUSES.failed };

  // Concurrency check
  if (detectConcurrentModification(proposal, projectData)) {
    return { ok: false, reason: "Project memory changed since proposal created — Review/Rebase/Cancel", status: "concurrent" };
  }

  // Apply to projectData in-memory
  const nextData = setSection(projectData, proposal.section, proposal.after);

  // Route through Save Gate — saveModcodes is the gate
  if (typeof saveModcodes !== "function") {
    return { ok: false, reason: "Save Gate unavailable" };
  }
  const result = await saveModcodes({ rootName, data: nextData });
  if (!result.ok) {
    return { ok: false, reason: result.status || "save failed", status: PROPOSAL_STATUSES.failed, proposal: { ...proposal, status: PROPOSAL_STATUSES.failed } };
  }
  return { ok: true, data: nextData, proposal: { ...proposal, status: PROPOSAL_STATUSES.saved } };
}
