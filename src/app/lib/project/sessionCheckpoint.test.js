import { describe, it, expect } from "vitest";
import { createEmptyModcodes } from "./modcodes";
import {
  formatCheckpointEntry,
  appendSessionCheckpoint,
  listCheckpoints,
} from "./sessionCheckpoint";

describe("sessionCheckpoint", () => {
  it("formats a chat checkpoint entry with model and tools", () => {
    const entry = formatCheckpointEntry({
      checkpoint: {
        kind: "chat",
        prompt: "Add a dark mode toggle",
        summary: "Updated the theme context and header button.",
        provider: "ollama",
        model: "qwen2.5-coder",
        tools: ["ide.read-file", "ide.apply-patch"],
        status: "complete",
      },
      now: "2026-10-13T10:00:00.000Z",
    });
    expect(entry).toContain("### 2026-10-13T10:00:00.000Z — Chat turn");
    expect(entry).toContain("- **Asked:** Add a dark mode toggle");
    expect(entry).toContain("- **Result:** Updated the theme context and header button.");
    expect(entry).toContain("- **Model:** ollama/qwen2.5-coder");
    expect(entry).toContain("- **Tools:** ide.read-file, ide.apply-patch");
    expect(entry).toContain("- **Status:** complete");
  });

  it("clips long prompts and summaries instead of flooding the section", () => {
    const entry = formatCheckpointEntry({
      checkpoint: {
        kind: "chat",
        prompt: "x".repeat(500),
        summary: "y".repeat(900),
        status: "complete",
      },
      now: "2026-10-13T10:00:00.000Z",
    });
    const asked = entry.split("\n").find((line) => line.startsWith("- **Asked:**"));
    const result = entry.split("\n").find((line) => line.startsWith("- **Result:**"));
    expect(asked.length).toBeLessThan(200);
    expect(result.length).toBeLessThan(450);
    expect(entry).toContain("…");
  });

  it("appends checkpoints to Agent History and keeps other sections untouched", () => {
    const base = createEmptyModcodes({ name: "App" });
    const withDecision = { ...base, sections: { ...base.sections, Decisions: "### old" } };
    const next = appendSessionCheckpoint({
      modcodesData: withDecision,
      checkpoint: { kind: "chat", prompt: "hi", summary: "hello", status: "complete" },
    });
    expect(next.sections["Agent History"]).toContain("Chat turn");
    expect(next.sections["Agent History"]).toContain("- **Asked:** hi");
    expect(next.sections.Decisions).toBe("### old");
    expect(listCheckpoints(next).length).toBe(1);
  });

  it("keeps consecutive checkpoints in chronological order", () => {
    let data = createEmptyModcodes({ name: "App" });
    data = appendSessionCheckpoint({
      modcodesData: data,
      checkpoint: { kind: "chat", prompt: "first", summary: "one", status: "complete" },
    });
    data = appendSessionCheckpoint({
      modcodesData: data,
      checkpoint: { kind: "agent", prompt: "second", summary: "two", status: "completed" },
    });
    const entries = listCheckpoints(data);
    expect(entries.length).toBe(2);
    expect(entries[0]).toContain("first");
    expect(entries[1]).toContain("second");
    expect(entries[1]).toContain("Agent task");
  });

  it("caps Agent History at the 50 newest checkpoints", () => {
    let data = createEmptyModcodes({ name: "App" });
    for (let i = 0; i < 60; i += 1) {
      data = appendSessionCheckpoint({
        modcodesData: data,
        checkpoint: { kind: "chat", prompt: `turn ${i}`, summary: "s", status: "complete" },
      });
    }
    const entries = listCheckpoints(data);
    expect(entries.length).toBe(50);
    expect(entries.some((entry) => entry.includes("turn 9"))).toBe(false);
    expect(entries[0]).toContain("turn 10");
    expect(entries[entries.length - 1]).toContain("turn 59");
  });

  it("rejects missing inputs", () => {
    expect(() => appendSessionCheckpoint({ modcodesData: null, checkpoint: {} })).toThrow();
    expect(() => formatCheckpointEntry({ checkpoint: null })).toThrow();
  });
});
