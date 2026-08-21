import { describe, expect, it } from "vitest";
import {
  createStatsTracker,
  formatDurationMs,
  formatTokensPerSecond,
  normalizeStats,
} from "./index";
import { ollamaStreamStats } from "./providers/ollama";

describe("normalizeStats", () => {
  it("passes through runtime measurements", () => {
    const stats = normalizeStats({
      tokensPerSecond: 12.5,
      prefillMs: 300,
      decodeMs: 2500,
      durationMs: 2800,
      finishReason: "stop",
    });
    expect(stats.tokensPerSecond).toBe(12.5);
    expect(stats.prefillMs).toBe(300);
    expect(stats.decodeMs).toBe(2500);
    expect(stats.durationMs).toBe(2800);
    expect(stats.finishReason).toBe("stop");
  });

  it("computes tokensPerSecond from chars and duration when missing", () => {
    const stats = normalizeStats({ durationMs: 1000 }, { chars: 400 });
    expect(stats.outputTokens).toBe(100);
    expect(stats.tokensPerSecond).toBe(100);
  });

  it("ignores invalid values", () => {
    const stats = normalizeStats({ tokensPerSecond: NaN, durationMs: -5 }, {});
    expect(stats.tokensPerSecond).toBeNull();
    expect(stats.durationMs).toBeNull();
  });
});

describe("formatting helpers", () => {
  it("formats tokens per second", () => {
    expect(formatTokensPerSecond(128)).toBe("128 tok/s");
    expect(formatTokensPerSecond(12.34)).toBe("12.3 tok/s");
    expect(formatTokensPerSecond(null)).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(350)).toBe("350ms");
    expect(formatDurationMs(-1)).toBeNull();
  });
});

describe("createStatsTracker", () => {
  it("records and returns the last entry", () => {
    const tracker = createStatsTracker({ limit: 2 });
    tracker.record({ tokensPerSecond: 10, model: "a" });
    tracker.record({ tokensPerSecond: 20, model: "b" });
    tracker.record({ tokensPerSecond: 30, model: "c" });
    expect(tracker.last().tokensPerSecond).toBe(30);
    expect(tracker.recent(10)).toHaveLength(2);
  });

  it("clears entries", () => {
    const tracker = createStatsTracker();
    tracker.record({ tokensPerSecond: 5 });
    tracker.clear();
    expect(tracker.last()).toBeNull();
  });
});

describe("ollamaStreamStats", () => {
  it("derives tokensPerSecond from eval metrics", () => {
    const stats = ollamaStreamStats({
      eval_count: 100,
      eval_duration: 2_000_000_000,
      total_duration: 3_000_000_000,
      done_reason: "stop",
    });
    expect(stats.outputTokens).toBe(100);
    expect(stats.decodeMs).toBe(2000);
    expect(stats.tokensPerSecond).toBeCloseTo(50);
    expect(stats.durationMs).toBe(3000);
  });

  it("returns null when eval_count is missing", () => {
    expect(ollamaStreamStats({ done: true })).toBeNull();
  });
});