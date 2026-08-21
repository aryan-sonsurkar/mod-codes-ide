import { describe, expect, it } from "vitest";
import { buildContext } from "./context";
import { createContextCache, measureContextBuild } from "./contextPerformance";

describe("context performance", () => {
  it("measures build duration", () => {
    const { durationMs, candidates } = measureContextBuild(buildContext, {
      currentFile: { path: "src/a.js", content: "hello" },
    });
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(candidates).toBeGreaterThanOrEqual(1);
  });

  it("caches unchanged context", () => {
    const cache = createContextCache({ ttlMs: 10000 });
    const request = { currentFile: { path: "src/a.js", content: "hello" }, budget: 4000 };
    expect(cache.get(request)).toBeNull();
    cache.set(request, { budget: 4000 });
    expect(cache.get(request).budget).toBe(4000);
    cache.clear();
    expect(cache.get(request)).toBeNull();
  });
});
