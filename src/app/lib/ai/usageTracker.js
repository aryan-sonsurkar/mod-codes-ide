"use client";

const STORAGE_KEY = "modcodes-usage";
const SESSION_KEY = "modcodes-usage-session";

const DEFAULT_LIMITS = {
  daily: null,
  session: null,
  project: null,
};

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
