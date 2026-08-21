import { describe, expect, it } from "vitest";
import { buildContext, buildContextPreview } from "../../../lib/ai";

describe("AIContextInspector preview", () => {
  it("reports truncated state and limitedBy", () => {
    const context = buildContext({
      currentFile: { path: "src/a.js", content: "x".repeat(50000) },
      model: { id: "test", contextLength: 4000 },
    });
    const preview = buildContextPreview(context);
    expect(context.limitedBy).toBe(4000);
    expect(preview.limitedBy).toBe(4000);
    expect(preview.truncated || context.remaining === 0).toBe(true);
  });

  it("exposes budget visibility", () => {
    const context = buildContext({
      currentFile: { path: "src/a.js", content: "hello" },
      budget: 4000,
    });
    const preview = buildContextPreview(context);
    expect(preview.budget).toBe(4000);
    expect(context.used).toBeGreaterThan(0);
  });
});
