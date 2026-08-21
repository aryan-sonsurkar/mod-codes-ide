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

const ACTION_STORAGE_KEY = "modcodes.ai.actionHistory.v1";

function loadStored(limit) {
  try {
    if (typeof localStorage === "undefined") {
      return [];
    }
    const raw = localStorage.getItem(ACTION_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, limit).map((e) => createActionEntry(e));
  } catch {
    return [];
  }
}

function persist(entries) {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    const sanitized = entries.slice(0, 100).map((e) => ({
      id: e.id,
      action: e.action,
      provider: e.provider,
      model: e.model,
      timestamp: e.timestamp,
      target: e.target,
      accepted: e.accepted,
      files: e.files,
    }));
    localStorage.setItem(ACTION_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {}
}

export function createActionHistory({ limit = 100 } = {}) {
  const entries = loadStored(limit);

  return {
    add(entry) {
      const sanitized = createActionEntry(entry);
      entries.unshift(sanitized);
      if (entries.length > limit) {
        entries.length = limit;
      }
      persist(entries);
      return sanitized;
    },
    list() {
      return [...entries];
    },
    clear() {
      entries.length = 0;
      persist(entries);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(ACTION_STORAGE_KEY);
        }
      } catch {}
    },
    get(id) {
      return entries.find((e) => e.id === id) || null;
    },
  };
}

export function resetActionIdForTests() {
  nextActionId = 0;
}
