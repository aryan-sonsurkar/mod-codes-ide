let nextActionId = 0;

export function createActionEntry({
  id = null,
  action,
  provider = null,
  model = null,
  target = null,
  result = null,
  accepted = null,
  files = [],
  timestamp = null,
} = {}) {
  if (typeof action !== "string" || action.length === 0) {
    throw new TypeError("Action is required");
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : `act-${nextActionId++}-${Date.now()}`,
    action,
    provider: typeof provider === "string" ? provider : null,
    model: typeof model === "string" ? model : null,
    target: typeof target === "string" ? target : null,
    result: typeof result === "string" ? result.slice(0, 500) : null,
    accepted: typeof accepted === "boolean" ? accepted : null,
    files: Array.isArray(files) ? files.slice(0, 20) : [],
    timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
  };
}

export function createActionHistory({ limit = 100 } = {}) {
  const entries = [];

  return {
    add(entry) {
      const sanitized = createActionEntry(entry);
      entries.unshift(sanitized);
      if (entries.length > limit) {
        entries.length = limit;
      }
      return sanitized;
    },
    list() {
      return [...entries];
    },
    clear() {
      entries.length = 0;
    },
    get(id) {
      return entries.find((e) => e.id === id) || null;
    },
  };
}

export function resetActionIdForTests() {
  nextActionId = 0;
}
