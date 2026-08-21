import { describe, expect, it } from "vitest";
import { rankWorkspaceContext } from "./relevanceRanking";

describe("relevance ranking", () => {
  it("ranks current file highest", () => {
    const result = rankWorkspaceContext({
      candidates: [
        { path: "src/a.js", content: "hello", size: 5 },
        { path: "src/b.js", content: "world", size: 5 },
      ],
      currentFile: { path: "src/a.js" },
      budget: 100,
    });
    expect(result.ranked[0].path).toBe("src/a.js");
    expect(result.included[0].included).toBe(true);
  });

  it("excludes secret paths", () => {
    const result = rankWorkspaceContext({
      candidates: [
        { path: ".env", content: "SECRET", size: 6 },
        { path: "src/a.js", content: "ok", size: 2 },
      ],
      budget: 100,
    });
    expect(result.ranked.some((r) => r.path === ".env")).toBe(false);
  });

  it("respects budget", () => {
    const result = rankWorkspaceContext({
      candidates: [
        { path: "src/a.js", content: "x".repeat(50), size: 50 },
        { path: "src/b.js", content: "x".repeat(50), size: 50 },
      ],
      budget: 60,
    });
    expect(result.included).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
  });
});
