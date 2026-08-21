import { describe, expect, it, vi } from "vitest";
import { acceptDiff, computeChangedRanges, createDiff, createDiffSession } from "./diffEngine";

describe("diffEngine", () => {
  it("computes changed ranges", () => {
    const ranges = computeChangedRanges("a\nb\nc", "a\nx\nc");
    expect(ranges).toHaveLength(1);
    expect(ranges[0].originalStart).toBe(2);
  });

  it("creates a diff with metadata", () => {
    const diff = createDiff({
      path: "src/a.js",
      original: "const a=1;",
      proposed: "const a=2;",
      actionId: "ai.improve-code",
    });
    expect(diff.path).toBe("src/a.js");
    expect(diff.ranges.length).toBeGreaterThan(0);
    expect(diff.status).toBe("pending");
  });

  it("accepts a diff via DocumentManager", () => {
    const dm = { setContent: vi.fn() };
    const diff = createDiff({ path: "src/a.js", original: "a", proposed: "b" });
    const next = acceptDiff(dm, diff);
    expect(dm.setContent).toHaveBeenCalledWith("src/a.js", "a.js", "b", "a");
    expect(next.status).toBe("accepted");
  });

  it("rejects a diff", () => {
    const session = createDiffSession();
    const diff = session.create({ path: "src/a.js", original: "a", proposed: "b" });
    const rejected = session.reject(diff.id);
    expect(rejected.status).toBe("rejected");
  });

  it("does not apply when content is identical", () => {
    const dm = { setContent: vi.fn() };
    const diff = createDiff({ path: "src/a.js", original: "same", proposed: "same" });
    const next = acceptDiff(dm, diff);
    expect(dm.setContent).not.toHaveBeenCalled();
    expect(next.applied).toBe(false);
  });
});
