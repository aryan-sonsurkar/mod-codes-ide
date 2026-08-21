export function normalizeStats(raw = {}, { chars = null } = {}) {
  const tokensPerSecond =
    raw && typeof raw.tokensPerSecond === "number" && Number.isFinite(raw.tokensPerSecond)
      ? raw.tokensPerSecond
      : null;
  const outputTokens =
    Number.isFinite(chars) && chars > 0 ? Math.max(1, Math.ceil(chars / 4)) : null;

  const computed =
    tokensPerSecond == null && outputTokens != null && Number.isFinite(raw.durationMs)
      ? outputTokens / (raw.durationMs / 1000)
      : tokensPerSecond;

  return {
    tokensPerSecond:
      computed != null && Number.isFinite(computed) && computed > 0 ? computed : null,
    outputTokens,
    prefillMs:
      raw && typeof raw.prefillMs === "number" && Number.isFinite(raw.prefillMs)
        ? raw.prefillMs
        : null,
    decodeMs:
      raw && typeof raw.decodeMs === "number" && Number.isFinite(raw.decodeMs)
        ? raw.decodeMs
        : null,
    durationMs:
      raw && typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs) && raw.durationMs >= 0
        ? raw.durationMs
        : null,
    finishReason:
      raw && typeof raw.finishReason === "string" && raw.finishReason.length > 0
        ? raw.finishReason
        : null,
  };
}

export function formatTokensPerSecond(tokensPerSecond) {
  if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) {
    return null;
  }
  if (tokensPerSecond >= 100) {
    return `${Math.round(tokensPerSecond)} tok/s`;
  }
  return `${tokensPerSecond.toFixed(1)} tok/s`;
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function createStatsTracker({ limit = 20 } = {}) {
  const entries = [];

  function record(entry = {}) {
    const normalized = normalizeStats(entry, { chars: entry.chars });
    const recorded = {
      ...normalized,
      model: typeof entry.model === "string" ? entry.model : null,
      provider: typeof entry.provider === "string" ? entry.provider : null,
      timestamp: Date.now(),
    };
    entries.push(recorded);
    if (entries.length > limit) {
      entries.splice(0, entries.length - limit);
    }
    return recorded;
  }

  return {
    record,
    last() {
      return entries.length > 0 ? entries[entries.length - 1] : null;
    },
    recent(count = 5) {
      return entries.slice(-count);
    },
    clear() {
      entries.length = 0;
    },
  };
}