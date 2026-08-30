"use client";

// Hybrid reconciliation: minor factual auto-update vs meaningful decision proposal.
export function reconcileProjectMemory({ modcodesData, codebaseSnapshot }) {
  // codebaseSnapshot: { fileCount, depsCount, prdHash, authExists, testsExist, filesChangedSinceLastSession }
  const proposals = [];
  const autoUpdates = [];

  if (!modcodesData) return { proposals, autoUpdates };

  const now = new Date().toISOString();

  // Example rule: if codebase has auth flow but Progress says not done → propose update
  if (codebaseSnapshot && codebaseSnapshot.authExists) {
    const progress = String(modcodesData.sections?.Progress || "");
    if (!progress.toLowerCase().includes("auth")) {
      proposals.push({
        id: "auth-complete",
        title: "Authentication appears complete",
        evidence: ["login flow exists", "session handling exists", codebaseSnapshot.testsExist ? "tests exist" : null].filter(Boolean),
        proposedChange: { section: "Progress", append: `\n- Auth flow verified ${now}` },
        actions: ["Accept", "Edit", "Reject"],
      });
    }
  }

  // File count drift → auto-update Project Context metadata (minor factual)
  if (codebaseSnapshot && typeof codebaseSnapshot.fileCount === "number") {
    autoUpdates.push({ field: "fileCount", value: codebaseSnapshot.fileCount });
  }

  // Stale detection: if modcodes older than 7 days
  const updatedAt = modcodesData.project?.updatedAt ? Date.parse(modcodesData.project.updatedAt) : NaN;
  if (!Number.isNaN(updatedAt)) {
    const ageDays = (Date.now() - updatedAt) / (24 * 3600 * 1000);
    if (ageDays > 7) {
      proposals.push({
        id: "stale-memory",
        title: "Project memory may be outdated",
        evidence: [`Last updated ${Math.floor(ageDays)} days ago`, `${codebaseSnapshot?.filesChangedSinceLastSession || 0} files changed since last session`],
        proposedChange: null,
        actions: ["Review Changes", "Dismiss"],
      });
    }
  }

  return { proposals, autoUpdates, checkedAt: now };
}

export function applyReconcileAccept({ modcodesData, proposal }) {
  if (!proposal || !proposal.proposedChange) return modcodesData;
  const { section, append } = proposal.proposedChange;
  if (!section || !append) return modcodesData;
  const current = String(modcodesData.sections?.[section] || "");
  return {
    ...modcodesData,
    project: { ...modcodesData.project, updatedAt: new Date().toISOString() },
    sections: { ...modcodesData.sections, [section]: current + append },
  };
}
