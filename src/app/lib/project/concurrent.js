"use client";

// Detect concurrent user/agent edits on same file using paths + lastModified/dirty.
export function detectConcurrentEdits({ userEditedPaths, agentChangeset, openDocuments, lastModifiedMap }) {
  const agentPaths = new Set((agentChangeset?.changes || []).map((c) => c.path));
  const conflicts = [];
  for (const p of userEditedPaths || []) {
    if (agentPaths.has(p)) {
      // check dirty or lastModified drift: if user has dirty or file mtime changed since agent snapshot
      const doc = openDocuments ? openDocuments.find((d)=>d.path===p) : null;
      const isDirty = doc ? Boolean(doc.dirty) : false;
      const mtime = lastModifiedMap ? lastModifiedMap.get(p) : null;
      const agentMtime = agentChangeset?.snapshotMtimes ? agentChangeset.snapshotMtimes[p] : null;
      const mtimeChanged = mtime != null && agentMtime != null && mtime !== agentMtime;
      if (isDirty || mtimeChanged || !mtime) conflicts.push(p);
      else conflicts.push(p); // still conflict on path overlap — prefer user
    }
  }
  return conflicts;
}

export function concurrentMessage(conflicts) {
  if (!conflicts || conflicts.length === 0) return null;
  return `⚠ File changed by you while the agent was working: ${conflicts.join(", ")} — Options: Review / Keep mine / Keep agent version / Merge. Prefer preserving user changes.`;
}
