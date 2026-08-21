export function measureContextBuild(buildFn, request) {
  const start = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  const result = buildFn(request);
  const end = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  return {
    result,
    durationMs: end - start,
    candidates: result.items ? result.items.length : 0,
    included: result.items ? result.items.filter((i) => !i.truncated).length : 0,
    budget: result.budget ?? null,
    used: result.used ?? null,
  };
}

export function createContextCache({ ttlMs = 2000 } = {}) {
  let cachedKey = null;
  let cachedValue = null;
  let cachedAt = 0;

  function keyFor(request) {
    const parts = [
      request.budget ?? "",
      (request.sources || []).join(","),
      request.currentFile ? `${request.currentFile.path}:${request.currentFile.content?.length ?? 0}` : "",
      request.selection ? `${request.selection.path}:${request.selection.text?.length ?? 0}` : "",
    ];
    return parts.join("|");
  }

  return {
    get(request) {
      const key = keyFor(request);
      if (key === cachedKey && Date.now() - cachedAt < ttlMs) {
        return cachedValue;
      }
      return null;
    },
    set(request, value) {
      cachedKey = keyFor(request);
      cachedValue = value;
      cachedAt = Date.now();
    },
    clear() {
      cachedKey = null;
      cachedValue = null;
      cachedAt = 0;
    },
  };
}
