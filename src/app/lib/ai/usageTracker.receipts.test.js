import { beforeEach, describe, expect, it } from "vitest";
import {
  createUsageTracker,
  describeUsageSpend,
  isLocalProvider,
  summarizeUsageLog,
  usageLogToCsv,
} from "./usageTracker";

beforeEach(() => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();
    } catch {}
  }
});

describe("usage tracker receipt fields", () => {
  it("stores model, kind, label, and durationMs on entries", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({
      provider: "ollama",
      model: "qwen2.5-coder:1.5b",
      kind: "agent",
      label: "Rename foo to bar",
      durationMs: 1234.6,
      totalTokens: 200,
    });
    expect(entry.model).toBe("qwen2.5-coder:1.5b");
    expect(entry.kind).toBe("agent");
    expect(entry.label).toBe("Rename foo to bar");
    expect(entry.durationMs).toBe(1235);
    expect(entry.accounting).toBe("actual");
  });

  it("defaults kind to chat and nulls absent optional fields", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "browser-bonsai" });
    expect(entry.kind).toBe("chat");
    expect(entry.model).toBeNull();
    expect(entry.label).toBeNull();
    expect(entry.durationMs).toBeNull();
  });

  it("clips long labels to 80 characters", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({
      provider: "ollama",
      label: "x".repeat(200),
    });
    expect(entry.label).toHaveLength(80);
  });

  it("rejects negative durations", () => {
    const tracker = createUsageTracker();
    const entry = tracker.trackUsage({ provider: "ollama", durationMs: -5 });
    expect(entry.durationMs).toBeNull();
  });

  it("returns log entries via getUsage", () => {
    const tracker = createUsageTracker();
    tracker.trackUsage({ provider: "ollama", model: "m", totalTokens: 10 });
    tracker.trackUsage({ provider: "browser-bonsai", kind: "agent" });
    const usage = tracker.getUsage();
    expect(usage.log).toHaveLength(2);
    expect(usage.log[0].model).toBe("m");
    expect(usage.log[1].kind).toBe("agent");
  });
});

describe("isLocalProvider", () => {
  it("treats browser-bonsai and ollama as local", () => {
    expect(isLocalProvider("browser-bonsai")).toBe(true);
    expect(isLocalProvider("ollama")).toBe(true);
  });

  it("treats anything else as non-local", () => {
    expect(isLocalProvider("openrouter")).toBe(false);
    expect(isLocalProvider("")).toBe(false);
    expect(isLocalProvider(null)).toBe(false);
  });
});

describe("describeUsageSpend", () => {
  it("local providers are always free", () => {
    expect(describeUsageSpend("ollama", "unknown")).toContain("$0.00");
    expect(describeUsageSpend("browser-bonsai", "actual")).toContain("no meter to burn");
  });

  it("api providers surface the accounting basis", () => {
    expect(describeUsageSpend("openrouter", "actual")).toContain("actual tokens");
    expect(describeUsageSpend("openrouter", "estimated")).toContain("estimated");
    expect(describeUsageSpend("openrouter", "unknown")).toContain("unknown");
  });
});

describe("summarizeUsageLog", () => {
  it("counts turns, known tokens, unknown accounting, and local turns", () => {
    const log = [
      { provider: "ollama", known: true, totalTokens: 100, accounting: "actual" },
      { provider: "browser-bonsai", known: false, totalTokens: null, accounting: "unknown" },
      { provider: "openrouter", known: true, totalTokens: 50, accounting: "estimated" },
    ];
    const summary = summarizeUsageLog(log);
    expect(summary).toEqual({
      turns: 3,
      knownTokens: 150,
      unknownAccounting: 1,
      local: 2,
    });
  });

  it("handles empty log", () => {
    expect(summarizeUsageLog([])).toEqual({
      turns: 0,
      knownTokens: 0,
      unknownAccounting: 0,
      local: 0,
    });
  });
});

describe("usageLogToCsv", () => {
  it("emits a header and one quoted row per entry", () => {
    const log = [
      {
        timestamp: 0,
        provider: "ollama",
        model: "qwen",
        kind: "chat",
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        accounting: "actual",
        durationMs: 500,
        label: 'say "hi", then stop',
      },
    ];
    const csv = usageLogToCsv(log);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("provider");
    expect(lines[0]).toContain("label");
    expect(lines[1]).toContain('"ollama"');
    expect(lines[1]).toContain('"qwen"');
    expect(lines[1]).toContain('""hi""');
    expect(lines[1]).toContain('"30"');
  });

  it("collapses newlines in labels", () => {
    const csv = usageLogToCsv([
      { provider: "ollama", label: "line1\nline2", timestamp: 0 },
    ]);
    expect(csv).not.toContain("line1\nline2");
    expect(csv).toContain("line1 line2");
  });

  it("handles empty log with header only", () => {
    const csv = usageLogToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});
