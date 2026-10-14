"use client";

const STORAGE_KEY = "modcodes-usage";
const SESSION_KEY = "modcodes-usage-session";

const DEFAULT_LIMITS = {
  daily: null,
  session: null,
  project: null,
};

const LOCAL_PROVIDERS = new Set(["browser-bonsai", "ollama"]);

export function isLocalProvider(provider) {
  return LOCAL_PROVIDERS.has(String(provider || ""));
}

export function describeUsageSpend(provider, accounting = "unknown") {
  if (isLocalProvider(provider)) {
    return "local, $0.00 — no meter to burn";
  }
  if (accounting === "actual") {
    return "API usage — actual tokens, check your provider bill";
  }
  if (accounting === "estimated") {
    return "API usage — estimated, check your provider bill";
  }
  return "API usage — accounting unknown, check your provider bill";
}

export function summarizeUsageLog(log = []) {
  let turns = 0;
  let knownTokens = 0;
  let unknownAccounting = 0;
  let local = 0;
  for (const entry of log) {
    turns += 1;
    if (typeof entry.totalTokens === "number") knownTokens += entry.totalTokens;
    if (!entry.known || entry.accounting === "unknown") unknownAccounting += 1;
    if (isLocalProvider(entry.provider)) local += 1;
  }
  return { turns, knownTokens, unknownAccounting, local };
}

export function usageLogToCsv(log = []) {
  const header = "time,provider,model,kind,inputTokens,outputTokens,totalTokens,accounting,durationMs,label";
  const rows = log.map((entry) => {
    const cells = [
      new Date(entry.timestamp || 0).toISOString(),
      entry.provider || "",
      entry.model || "",
      entry.kind || "chat",
      entry.inputTokens ?? "",
      entry.outputTokens ?? "",
      entry.totalTokens ?? "",
      entry.accounting || "unknown",
      entry.durationMs ?? "",
      String(entry.label || "").replace(/[\r\n]+/g, " "),
    ];
    return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
  });
  return [header, ...rows].join("\n");
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadPersistedData() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersistedData(data) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadSessionData() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSessionData(data) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
}

export function createUsageTracker({
  limits = DEFAULT_LIMITS,
  projectId = null,
} = {}) {
  const persisted = loadPersistedData() || {};
  const sessionPersisted = loadSessionData() || {};

  let sessionCount = typeof sessionPersisted.count === "number" ? sessionPersisted.count : 0;
  let dailyCount = 0;
  let projectCount = 0;
  let lastResetDay = todayKey();
  let usageLog = [];

  if (persisted.daily) {
    const day = persisted.daily.day || todayKey();
    if (day === todayKey()) {
      dailyCount = persisted.daily.count || 0;
      lastResetDay = day;
    }
  }

  if (projectId && persisted.projects && persisted.projects[projectId]) {
    projectCount = persisted.projects[projectId] || 0;
  }

  if (Array.isArray(persisted.log)) {
    usageLog = persisted.log.slice(-500);
  }

  function checkDailyReset() {
    const today = todayKey();
    if (today !== lastResetDay) {
      dailyCount = 0;
      lastResetDay = today;
      const data = loadPersistedData() || {};
      data.daily = { day: today, count: 0 };
      savePersistedData(data);
    }
  }

  function persist() {
    const data = loadPersistedData() || {};
    data.daily = { day: lastResetDay, count: dailyCount };
    if (!data.projects) data.projects = {};
    if (projectId) {
      data.projects[projectId] = projectCount;
    }
    data.log = usageLog.slice(-500);
    savePersistedData(data);
    saveSessionData({ count: sessionCount });
  }

  function trackUsage({
    provider,
    model = null,
    kind = "chat",
    label = null,
    durationMs = null,
    inputTokens,
    outputTokens,
    totalTokens,
    accounting = "unknown",
  } = {}) {
    checkDailyReset();
    const total = typeof totalTokens === "number"
      ? totalTokens
      : (typeof inputTokens === "number" ? inputTokens : 0) +
        (typeof outputTokens === "number" ? outputTokens : 0);
    const isKnown = typeof totalTokens === "number" || typeof inputTokens === "number";

    sessionCount += total;
    dailyCount += total;
    projectCount += total;

    let resolvedAccounting = accounting;
    if (resolvedAccounting === "unknown" && isKnown) {
      resolvedAccounting = "actual";
    }

    const entry = {
      provider: String(provider || "unknown"),
      model: model ? String(model) : null,
      kind: kind === "agent" ? "agent" : "chat",
      label: label ? String(label).slice(0, 80) : null,
      durationMs: typeof durationMs === "number" && durationMs >= 0 ? Math.round(durationMs) : null,
      inputTokens: typeof inputTokens === "number" ? inputTokens : null,
      outputTokens: typeof outputTokens === "number" ? outputTokens : null,
      totalTokens: isKnown ? total : null,
      known: isKnown,
      accounting: resolvedAccounting,
      timestamp: Date.now(),
    };
    usageLog.push(entry);
    if (usageLog.length > 1000) usageLog = usageLog.slice(-500);

    persist();

    return entry;
  }

  function getUsage() {
    checkDailyReset();
    return {
      session: { total: sessionCount, limit: limits.session ?? null },
      daily: { total: dailyCount, limit: limits.daily ?? null },
      project: { total: projectCount, limit: limits.project ?? null },
      log: usageLog.slice(-100),
    };
  }

  function isLimitReached() {
    checkDailyReset();
    if (limits.daily !== null && dailyCount >= limits.daily) {
      return { reached: true, type: "daily", current: dailyCount, limit: limits.daily };
    }
    if (limits.session !== null && sessionCount >= limits.session) {
      return { reached: true, type: "session", current: sessionCount, limit: limits.session };
    }
    if (limits.project !== null && projectCount >= limits.project) {
      return { reached: true, type: "project", current: projectCount, limit: limits.project };
    }
    return { reached: false };
  }

  function getLimitStatus() {
    const limit = isLimitReached();
    if (!limit.reached) return { status: "ok", message: null };
    const messages = {
      daily: "Daily AI usage limit reached.",
      session: "Session usage limit reached.",
      project: "Project usage limit reached.",
    };
    return {
      status: "limit_reached",
      type: limit.type,
      current: limit.current,
      limit: limit.limit,
      message: messages[limit.type] || "Usage limit reached.",
    };
  }

  function checkLimit() {
    const status = getLimitStatus();
    return {
      allowed: status.status === "ok",
      reason: status.message || null,
      type: status.type || null,
      current: status.current || 0,
      limit: status.limit || null,
    };
  }

  function resetSession() {
    sessionCount = 0;
    usageLog = [];
    saveSessionData({ count: 0 });
  }

  function resetDaily() {
    dailyCount = 0;
    lastResetDay = todayKey();
    persist();
  }

  function resetProject() {
    projectCount = 0;
    persist();
  }

  function resetAll() {
    sessionCount = 0;
    dailyCount = 0;
    projectCount = 0;
    usageLog = [];
    lastResetDay = todayKey();
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
        storage.removeItem(SESSION_KEY);
      } catch {}
    }
  }

  function getAccountingSummary() {
    const recent = usageLog.slice(-50);
    let actual = 0;
    let estimated = 0;
    let unknown = 0;
    for (const entry of recent) {
      if (entry.accounting === "actual") actual++;
      else if (entry.accounting === "estimated") estimated++;
      else unknown++;
    }
    return { actual, estimated, unknown, total: recent.length };
  }

  return {
    trackUsage,
    getUsage,
    isLimitReached,
    getLimitStatus,
    checkLimit,
    resetSession,
    resetDaily,
    resetProject,
    resetAll,
    getAccountingSummary,
  };
}
