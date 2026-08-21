import { describe, expect, it } from "vitest";
import { createActionHistory } from "./actionHistory";

describe("action history", () => {
  it("tracks actions without secrets", () => {
    const history = createActionHistory({ limit: 5 });
    history.add({ action: "Explain", provider: "ollama", model: "qwen", files: ["src/a.js"], accepted: true });
    expect(history.list()).toHaveLength(1);
    expect(history.list()[0].files).toContain("src/a.js");
  });

  it("caps limit and clears", () => {
    const history = createActionHistory({ limit: 2 });
    history.add({ action: "a" });
    history.add({ action: "b" });
    history.add({ action: "c" });
    expect(history.list()).toHaveLength(2);
    history.clear();
    expect(history.list()).toHaveLength(0);
  });

  it("does not persist secret context", () => {
    const history = createActionHistory();
    const entry = history.add({ action: "Improve", provider: "bonsai", model: "bonsai-1.7b", result: "suggestion" });
    expect(entry.result).toBe("suggestion");
    expect(entry.action).toBe("Improve");
    expect(entry.provider).toBe("bonsai");
  });
});
