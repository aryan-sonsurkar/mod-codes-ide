"use client";
import { useCallback, useState } from "react";
import { createUsageTracker } from "../lib/ai/usageTracker";

let globalTracker = null;
let globalLimits = null;
let globalProjectId = null;

function getOrCreateTracker(limits, projectId) {
  const limitsKey = JSON.stringify(limits || {});
  if (
    globalTracker &&
    globalLimits === limitsKey &&
    globalProjectId === projectId
  ) {
    return globalTracker;
  }
  globalLimits = limitsKey;
  globalProjectId = projectId;
  globalTracker = createUsageTracker({ limits: limits || {}, projectId });
  return globalTracker;
}

export function useUsageTracker({ limits = {}, projectId = null } = {}) {
  const [usageSnapshot, setUsageSnapshot] = useState(null);

  const tracker = getOrCreateTracker(limits, projectId);

  const refresh = useCallback(() => {
    const usage = tracker.getUsage();
    setUsageSnapshot({ ...usage });
    return usage;
  }, [tracker]);

  const trackUsage = useCallback((entry) => {
    const result = tracker.trackUsage(entry);
    refresh();
    return result;
  }, [tracker, refresh]);

  const checkLimit = useCallback(() => {
    return tracker.checkLimit();
  }, [tracker]);

  const getLimitStatus = useCallback(() => {
    return tracker.getLimitStatus();
  }, [tracker]);

  const resetSession = useCallback(() => {
    tracker.resetSession();
    refresh();
  }, [tracker, refresh]);

  return {
    tracker,
    usage: usageSnapshot,
    trackUsage,
    checkLimit,
    getLimitStatus,
    refresh,
    resetSession,
  };
}
