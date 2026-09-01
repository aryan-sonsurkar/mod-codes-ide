"use client";

const DEFAULT_LIMITS = {
  daily: null,
  session: null,
  project: null,
};

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

export function createUsageTracker({ limits = DEFAULT_LIMITS } = {}) {
  let sessionCount = 0;
  let dailyCount = 0;
  let projectCount = 0;
  let lastResetDay = todayKey();
  let usageLog = [];

  function checkDailyReset() {
    const today = todayKey();
    if (today !== lastResetDay) {
      dailyCount = 0;
      lastResetDay = today;
    }
  }

  function trackUsage({ provider, inputTokens, outputTokens, totalTokens } = {}) {
    checkDailyReset();
    const total = typeof totalTokens === "number" ? totalTokens
      : (typeof inputTokens === "number" ? inputTokens : 0) +
        (typeof outputTokens === "number" ? outputTokens : 0);
    const isKnown = typeof totalTokens === "number" || typeof inputTokens === "number";

    sessionCount += total;
    dailyCount += total;
    projectCount += total;

    const entry = {
      provider: String(provider || "unknown"),
      inputTokens: typeof inputTokens === "number" ? inputTokens : null,
      outputTokens: typeof outputTokens === "number" ? outputTokens : null,
      totalTokens: isKnown ? total : null,
      known: isKnown,
      timestamp: Date.now(),
    };
    usageLog.push(entry);
    if (usageLog.length > 1000) usageLog = usageLog.slice(-500);

    return entry;
  }

  function getUsage() {
    checkDailyReset();
    return {
      session: { total: sessionCount, limit: limits.session },
      daily: { total: dailyCount, limit: limits.daily },
      project: { total: projectCount, limit: limits.project },
      log: usageLog.slice(-100),
    };
  }

  function isLimitReached() {
    checkDailyReset();
    if (limits.daily !== null && dailyCount >= limits.daily) return { reached: true, type: "daily", current: dailyCount, limit: limits.daily };
    if (limits.session !== null && sessionCount >= limits.session) return { reached: true, type: "session", current: sessionCount, limit: limits.session };
    if (limits.project !== null && projectCount >= limits.project) return { reached: true, type: "project", current: projectCount, limit: limits.project };
    return { reached: false };
  }

  function getLimitStatus() {
    const limit = isLimitReached();
    if (!limit.reached) return { status: "ok", message: null };
    const messages = {
      daily: "Daily usage limit reached for this provider.",
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

  function resetSession() {
    sessionCount = 0;
    usageLog = [];
  }

  function resetAll() {
    sessionCount = 0;
    dailyCount = 0;
    projectCount = 0;
    usageLog = [];
    lastResetDay = todayKey();
  }

  return {
    trackUsage,
    getUsage,
    isLimitReached,
    getLimitStatus,
    resetSession,
    resetAll,
  };
}
