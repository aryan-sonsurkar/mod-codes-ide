import { describe, expect, it } from "vitest";
import { createObservation, summarizeObservations } from "./agentObservation";

describe("observation", () => {
  it("creates structured observation without chain-of-thought", () => {
    const obs = createObservation({ tool: "ide.current-file", args: {}, result: "content", status: "success", durationMs: 10, stepId: "s1" });
    expect(obs.tool).toBe("ide.current-file");
    expect(obs.observation).toBeDefined();
    expect(obs.durationMs).toBe(10);
    expect(JSON.stringify(obs).includes("chain")).toBe(false);
  });

  it("summarizes observations", () => {
    const list = [createObservation({ tool: "ide.diagnostics", result: "err" })];
    expect(summarizeObservations(list)).toContain("ide.diagnostics");
  });
});
