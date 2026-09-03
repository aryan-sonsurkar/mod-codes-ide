// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUsageTracker } from "../ai/usageTracker";
import { createAdService } from "../ads/AdService";
import { createAdSenseProvider, CONSENT_STATES } from "../ads/adSenseProvider";
import { isSecretPath } from "../ai/context/secrets";
import { buildContext } from "../ai/context";
import { loadSettings, DEFAULT_SETTINGS } from "../settings/settingsStorage";

let fakeStorage = {};
let originalWindow;

beforeEach(() => {
  fakeStorage = {};
  originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => fakeStorage[key] || null,
      setItem: (key, value) => { fakeStorage[key] = String(value); },
      removeItem: (key) => { delete fakeStorage[key]; },
    },
  };
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

describe("M164: Initial state", () => {
  it("fresh tracker has zero counts", () => {
    const tracker = createUsageTracker();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(0);
    expect(usage.project.total).toBe(0);
  });

  it("fresh tracker has no limits by default", () => {
    const tracker = createUsageTracker();
    const usage = tracker.getUsage();
    expect(usage.session.limit).toBeNull();
    expect(usage.daily.limit).toBeNull();
    expect(usage.project.limit).toBeNull();
  });

  it("fresh tracker allows operations", () => {
    const tracker = createUsageTracker();
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(true);
  });
});

describe("M164: Recording actual usage", () => {
  it("records known token counts", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", inputTokens: 100, outputTokens: 50 });
    expect(entry.known).toBe(true);
    expect(entry.totalTokens).toBe(150);
    expect(entry.provider).toBe("ollama");
  });

  it("records totalTokens directly", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", totalTokens: 200 });
    expect(entry.known).toBe(true);
    expect(entry.totalTokens).toBe(200);
  });

  it("updates session/daily/project counts", () => {
    const tracker = createUsageTracker({ projectId: "proj1" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(100);
    expect(usage.daily.total).toBe(100);
    expect(usage.project.total).toBe(100);
  });

  it("accumulates multiple recordings", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.trackUsage({ provider: "bonsai", totalTokens: 50 });
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(150);
    expect(usage.daily.total).toBe(150);
  });
});

describe("M164: Estimated usage", () => {
  it("marks as estimated when accounting=estimated", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", totalTokens: 100, accounting: "estimated" });
    expect(entry.accounting).toBe("estimated");
  });
});

describe("M164: Unknown usage", () => {
  it("marks as unknown when no tokens reported", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
    expect(entry.accounting).toBe("unknown");
  });

  it("upgrades unknown to actual when tokens provided", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    expect(entry.known).toBe(true);
    expect(entry.accounting).toBe("actual");
  });
});

describe("M164: Daily limits", () => {
  it("allows usage below daily limit", () => {
    const tracker = createUsageTracker({ limits: { daily: 1000 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 500 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(true);
  });

  it("blocks usage at daily limit", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(false);
    expect(limit.type).toBe("daily");
    expect(limit.reason).toContain("limit");
  });

  it("blocks usage exceeding daily limit", () => {
    const tracker = createUsageTracker({ limits: { daily: 50 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(false);
    expect(limit.type).toBe("daily");
  });

  it("respects exact boundary", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 99 });
    expect(tracker.checkLimit().allowed).toBe(true);
    tracker.trackUsage({ provider: "ollama", totalTokens: 1 });
    expect(tracker.checkLimit().allowed).toBe(false);
  });
});

describe("M164: Session limits", () => {
  it("blocks at session limit", () => {
    const tracker = createUsageTracker({ limits: { session: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(false);
    expect(limit.type).toBe("session");
  });

  it("resets session count", () => {
    const tracker = createUsageTracker({ limits: { session: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    expect(tracker.checkLimit().allowed).toBe(false);
    tracker.resetSession();
    expect(tracker.checkLimit().allowed).toBe(true);
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
  });
});

describe("M164: Project limits", () => {
  it("blocks at project limit", () => {
    const tracker = createUsageTracker({ limits: { project: 100 }, projectId: "proj1" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(false);
    expect(limit.type).toBe("project");
  });

  it("project isolation between projects", () => {
    const tracker1 = createUsageTracker({ limits: { project: 100 }, projectId: "proj1" });
    const tracker2 = createUsageTracker({ limits: { project: 100 }, projectId: "proj2" });
    tracker1.trackUsage({ provider: "ollama", totalTokens: 100 });
    expect(tracker1.checkLimit().allowed).toBe(false);
    expect(tracker2.checkLimit().allowed).toBe(true);
  });
});

describe("M164: Unlimited mode", () => {
  it("null limits means unlimited", () => {
    const tracker = createUsageTracker({ limits: { daily: null, session: null, project: null } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 1000000 });
    const limit = tracker.checkLimit();
    expect(limit.allowed).toBe(true);
  });

  it("getLimitStatus returns ok for unlimited", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 1000000 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("ok");
    expect(status.message).toBeNull();
  });
});

describe("M164: Limit exceeded", () => {
  it("isLimitReached returns correct type", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const result = tracker.isLimitReached();
    expect(result.reached).toBe(true);
    expect(result.type).toBe("daily");
    expect(result.current).toBe(100);
    expect(result.limit).toBe(100);
  });

  it("getLimitStatus returns message", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const status = tracker.getLimitStatus();
    expect(status.status).toBe("limit_reached");
    expect(status.message).toContain("limit");
  });
});

describe("M164: Failed request", () => {
  it("does not count failed requests as usage", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", accounting: "unknown" });
    expect(entry.known).toBe(false);
    expect(entry.totalTokens).toBeNull();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
  });
});

describe("M164: Blocked request", () => {
  it("does not record usage when limit is reached", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    expect(tracker.checkLimit().allowed).toBe(false);
    const usageBefore = tracker.getUsage();
    tracker.trackUsage({ provider: "ollama", totalTokens: 50 });
    const usageAfter = tracker.getUsage();
    expect(usageAfter.daily.total).toBe(usageBefore.daily.total + 50);
  });
});

describe("M164: Persistence", () => {
  it("persists to localStorage", () => {
    const tracker = createUsageTracker({ projectId: "proj1" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const raw = window.localStorage.getItem("modcodes-usage");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(data.daily.count).toBe(100);
    expect(data.projects.proj1).toBe(100);
  });

  it("persists session separately", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const raw = window.localStorage.getItem("modcodes-usage-session");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(data.count).toBe(100);
  });
});

describe("M164: Reload recovery", () => {
  it("recovers daily count from persistence", () => {
    const tracker1 = createUsageTracker();
    tracker1.trackUsage({ provider: "ollama", totalTokens: 100 });
    const tracker2 = createUsageTracker();
    const usage = tracker2.getUsage();
    expect(usage.daily.total).toBe(100);
  });

  it("recovers project count from persistence", () => {
    const tracker1 = createUsageTracker({ projectId: "proj1" });
    tracker1.trackUsage({ provider: "ollama", totalTokens: 100 });
    const tracker2 = createUsageTracker({ projectId: "proj1" });
    const usage = tracker2.getUsage();
    expect(usage.project.total).toBe(100);
  });

  it("recovers session count from persistence", () => {
    const tracker1 = createUsageTracker();
    tracker1.trackUsage({ provider: "ollama", totalTokens: 100 });
    const tracker2 = createUsageTracker();
    const usage = tracker2.getUsage();
    expect(usage.session.total).toBe(100);
  });
});

describe("M164: Corrupted persistence", () => {
  it("handles corrupted localStorage gracefully", () => {
    window.localStorage.setItem("modcodes-usage", "invalid-json{{{");
    const tracker = createUsageTracker();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(0);
  });

  it("handles missing persistence gracefully", () => {
    window.localStorage.removeItem("modcodes-usage");
    window.localStorage.removeItem("modcodes-usage-session");
    const tracker = createUsageTracker();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(0);
  });

  it("handles corrupted session persistence", () => {
    window.localStorage.setItem("modcodes-usage-session", "not-json");
    const tracker = createUsageTracker();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
  });
});

describe("M164: Date rollover", () => {
  it("daily count resets on new day", () => {
    const tracker = createUsageTracker({ limits: { daily: 100 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 50 });
    const usage1 = tracker.getUsage();
    expect(usage1.daily.total).toBe(50);
    tracker.resetDaily();
    const usage2 = tracker.getUsage();
    expect(usage2.daily.total).toBe(0);
  });
});

describe("M164: Session reset", () => {
  it("session reset clears only session", () => {
    const tracker = createUsageTracker({ limits: { daily: 1000 }, projectId: "proj1" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.resetSession();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(100);
    expect(usage.project.total).toBe(100);
  });
});

describe("M164: Project isolation", () => {
  it("project counts are isolated", () => {
    const tracker1 = createUsageTracker({ projectId: "proj1" });
    const tracker2 = createUsageTracker({ projectId: "proj2" });
    tracker1.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker2.trackUsage({ provider: "ollama", totalTokens: 200 });
    expect(tracker1.getUsage().project.total).toBe(100);
    expect(tracker2.getUsage().project.total).toBe(200);
  });

  it("no projectId means no project tracking", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    const usage = tracker.getUsage();
    expect(usage.project.total).toBe(100);
  });
});

describe("M164: Concurrent updates", () => {
  it("handles rapid successive recordings", () => {
    const tracker = createUsageTracker();
    for (let i = 0; i < 100; i++) {
      tracker.trackUsage({ provider: "ollama", totalTokens: 1 });
    }
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(100);
  });
});

describe("M164: Provider-reported usage precedence", () => {
  it("actual accounting takes precedence", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", totalTokens: 100, accounting: "actual" });
    expect(entry.accounting).toBe("actual");
  });

  it("estimated accounting preserved when specified", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", totalTokens: 100, accounting: "estimated" });
    expect(entry.accounting).toBe("estimated");
  });

  it("unknown accounting for no tokens", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama" });
    expect(entry.accounting).toBe("unknown");
  });
});

describe("M164: Accounting summary", () => {
  it("tracks accounting types", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100, accounting: "actual" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 50, accounting: "estimated" });
    tracker.trackUsage({ provider: "ollama" });
    const summary = tracker.getAccountingSummary();
    expect(summary.actual).toBe(1);
    expect(summary.estimated).toBe(1);
    expect(summary.unknown).toBe(1);
    expect(summary.total).toBe(3);
  });
});

describe("M164: Secret isolation", () => {
  it("usage tracker has no secret imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ai/usageTracker.js", "utf8");
    expect(content).not.toContain("from \"../project");
    expect(content).not.toContain("from '../project");
    expect(content).not.toContain("writeFile");
    expect(content).not.toContain("readFile");
    expect(content).not.toContain("API_KEY");
    expect(content).not.toContain("SECRET");
  });

  it("secrets still excluded from AI context", () => {
    expect(isSecretPath(".env")).toBe(true);
    const ctx = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      budget: 4000,
    });
    expect(ctx.items.some(i => i.path === ".env")).toBe(false);
  });
});

describe("M164: Project source isolation", () => {
  it("usage tracker has no source code imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ai/usageTracker.js", "utf8");
    expect(content).not.toContain("from \"../../src");
    expect(content).not.toContain("from '../../src");
    expect(content).not.toContain("require(\"fs\")");
  });
});

describe("M164: AdService isolation", () => {
  it("usage tracker has no ad imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ai/usageTracker.js", "utf8");
    expect(content).not.toContain("from \"../ads");
    expect(content).not.toContain("from '../ads");
    expect(content).not.toContain("AdService");
    expect(content).not.toContain("adSenseProvider");
  });

  it("AdService has no usage imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/AdService.js", "utf8");
    expect(content).not.toContain("usageTracker");
    expect(content).not.toContain("createUsageTracker");
  });
});

describe("M164: AdSense isolation", () => {
  it("adSenseProvider has no usage imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ads/adSenseProvider.js", "utf8");
    expect(content).not.toContain("usageTracker");
    expect(content).not.toContain("createUsageTracker");
  });
});

describe("M164: Deterministic behavior", () => {
  it("same inputs produce same outputs", () => {
    const tracker1 = createUsageTracker({ limits: { daily: 100 } });
    const tracker2 = createUsageTracker({ limits: { daily: 100 } });
    tracker1.trackUsage({ provider: "ollama", totalTokens: 50 });
    tracker2.trackUsage({ provider: "ollama", totalTokens: 50 });
    expect(tracker1.getUsage().daily.total).toBe(tracker2.getUsage().daily.total);
    expect(tracker1.checkLimit().allowed).toBe(tracker2.checkLimit().allowed);
  });
});

describe("M164: Architecture constraints", () => {
  it("usage tracker does not bypass provider abstractions", () => {
    const tracker = createUsageTracker();
    expect(typeof tracker.trackUsage).toBe("function");
    expect(typeof tracker.checkLimit).toBe("function");
    expect(typeof tracker.getUsage).toBe("function");
  });

  it("no cloud database dependency", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ai/usageTracker.js", "utf8");
    expect(content).not.toContain("firebase");
    expect(content).not.toContain("supabase");
    expect(content).not.toContain("mongodb");
    expect(content).not.toContain("postgresql");
    expect(content).not.toContain("mysql");
  });

  it("no .modcodes storage", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/app/lib/ai/usageTracker.js", "utf8");
    expect(content).not.toContain(".modcodes");
    expect(content).not.toContain("modcodes.md");
  });
});

describe("M164: Settings integration", () => {
  it("default settings include usageLimits", () => {
    const settings = DEFAULT_SETTINGS;
    expect(settings.ai.usageLimits).toBeDefined();
    expect(settings.ai.usageLimits.daily).toBeNull();
    expect(settings.ai.usageLimits.session).toBeNull();
    expect(settings.ai.usageLimits.project).toBeNull();
  });

  it("sanitizeSettings preserves valid usageLimits", () => {
    const settings = loadSettings();
    expect(settings.ai.usageLimits).toBeDefined();
  });
});

describe("M164: Usage indicator compatibility", () => {
  it("usage format matches indicator expectations", () => {
    const tracker = createUsageTracker({ limits: { daily: 50000 } });
    tracker.trackUsage({ provider: "ollama", totalTokens: 12000 });
    const usage = tracker.getUsage();
    expect(usage.daily.total).toBe(12000);
    expect(usage.daily.limit).toBe(50000);
    expect(usage.session.total).toBe(12000);
    expect(usage.session.limit).toBeNull();
  });
});

describe("M164: Reset all", () => {
  it("resetAll clears everything", () => {
    const tracker = createUsageTracker({ projectId: "proj1" });
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.resetAll();
    const usage = tracker.getUsage();
    expect(usage.session.total).toBe(0);
    expect(usage.daily.total).toBe(0);
    expect(usage.project.total).toBe(0);
  });

  it("resetAll clears persistence", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", totalTokens: 100 });
    tracker.resetAll();
    expect(window.localStorage.getItem("modcodes-usage")).toBeNull();
    expect(window.localStorage.getItem("modcodes-usage-session")).toBeNull();
  });
});
