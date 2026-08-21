let nextDiffId = 0;

function generateDiffId() {
  nextDiffId += 1;
  return `diff-${nextDiffId}-${Date.now()}`;
}

export function resetDiffIdForTests() {
  nextDiffId = 0;
}

export function computeChangedRanges(original, proposed) {
  const a = (original || "").split("\n");
  const b = (proposed || "").split("\n");
  const ranges = [];
  let start = null;

  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const lineA = a[i];
    const lineB = b[i];
    if (lineA !== lineB) {
      if (start === null) {
        start = i;
      }
    } else if (start !== null) {
      ranges.push({
        originalStart: start + 1,
        originalEnd: i,
        proposedStart: start + 1,
        proposedEnd: i,
      });
      start = null;
    }
  }
  if (start !== null) {
    ranges.push({
      originalStart: start + 1,
      originalEnd: max,
      proposedStart: start + 1,
      proposedEnd: max,
    });
  }
  return ranges;
}

export function createDiff({
  id = null,
  path,
  original,
  proposed,
  actionId = null,
  metadata = null,
} = {}) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Diff requires a target path");
  }
  if (typeof original !== "string" || typeof proposed !== "string") {
    throw new TypeError("Diff requires original and proposed content");
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : generateDiffId(),
    path,
    original,
    proposed,
    actionId: typeof actionId === "string" ? actionId : null,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
    ranges: computeChangedRanges(original, proposed),
    createdAt: Date.now(),
    status: "pending",
  };
}

export function acceptDiff(documentManager, diff) {
  if (!documentManager || typeof documentManager.setContent !== "function") {
    throw new TypeError("DocumentManager is required");
  }
  if (!diff || typeof diff.path !== "string") {
    throw new TypeError("Diff is required");
  }
  if (diff.original === diff.proposed) {
    return { ...diff, status: "accepted", applied: false };
  }
  const name = diff.path.split("/").pop() || diff.path;
  documentManager.setContent(diff.path, name, diff.proposed, diff.original);
  return { ...diff, status: "accepted", applied: true };
}

export function rejectDiff(diff) {
  return { ...diff, status: "rejected" };
}

export function createDiffSession() {
  const diffs = new Map();

  return {
    create(params) {
      const diff = createDiff(params);
      diffs.set(diff.id, diff);
      return diff;
    },
    get(id) {
      return diffs.get(id) || null;
    },
    list() {
      return Array.from(diffs.values());
    },
    accept(documentManager, id) {
      const diff = diffs.get(id);
      if (!diff) {
        return null;
      }
      const next = acceptDiff(documentManager, diff);
      diffs.set(id, next);
      return next;
    },
    reject(id) {
      const diff = diffs.get(id);
      if (!diff) {
        return null;
      }
      const next = rejectDiff(diff);
      diffs.set(id, next);
      return next;
    },
    clear() {
      diffs.clear();
    },
  };
}

export function createMultiFileDiffSession() {
  const diffs = new Map();

  return {
    add(params) {
      const diff = createDiff(params);
      diffs.set(diff.path, diff);
      return diff;
    },
    get(path) {
      return diffs.get(path) || null;
    },
    getById(id) {
      for (const diff of diffs.values()) {
        if (diff.id === id) {
          return diff;
        }
      }
      return null;
    },
    list() {
      return Array.from(diffs.values());
    },
    accept(documentManager, path) {
      const diff = diffs.get(path);
      if (!diff) {
        return null;
      }
      const next = acceptDiff(documentManager, diff);
      diffs.set(path, next);
      return next;
    },
    acceptAll(documentManager) {
      const results = [];
      for (const diff of diffs.values()) {
        if (diff.status === "pending") {
          const next = acceptDiff(documentManager, diff);
          diffs.set(diff.path, next);
          results.push(next);
        }
      }
      return results;
    },
    reject(path) {
      const diff = diffs.get(path);
      if (!diff) {
        return null;
      }
      const next = rejectDiff(diff);
      diffs.set(path, next);
      return next;
    },
    rejectAll() {
      const results = [];
      for (const diff of diffs.values()) {
        if (diff.status === "pending") {
          const next = rejectDiff(diff);
          diffs.set(diff.path, next);
          results.push(next);
        }
      }
      return results;
    },
    cancel() {
      diffs.clear();
    },
    clear() {
      diffs.clear();
    },
    summary() {
      const all = Array.from(diffs.values());
      return {
        total: all.length,
        pending: all.filter((d) => d.status === "pending").length,
        accepted: all.filter((d) => d.status === "accepted").length,
        rejected: all.filter((d) => d.status === "rejected").length,
      };
    },
  };
}
