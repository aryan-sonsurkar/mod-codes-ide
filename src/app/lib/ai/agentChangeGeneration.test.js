import { describe, expect, it } from "vitest";
import { agentObservationsToChangeset } from "./agentChangeGeneration";

describe("agent change generation", () => {
  it("validates paths and duplicate ops", () => {
    expect(() => agentObservationsToChangeset({ proposedEdits: [] })).toThrow();
    expect(() =>
      agentObservationsToChangeset({
        proposedEdits: [
          { path: "src/a.js", proposed: "b" },
          { path: "src/a.js", proposed: "c" },
        ],
      })
    ).toThrow(/Duplicate/);
  });

  it("creates validated changeset", () => {
    const cs = agentObservationsToChangeset({
      observations: [{ tool: "ide.diagnostics" }],
      proposedEdits: [{ path: "src/a.js", original: "a", proposed: "b", reason: "fix" }],
    });
    expect(cs.operations[0].path).toBe("src/a.js");
  });

  it("never writes to filesystem", () => {
    const cs = agentObservationsToChangeset({
      proposedEdits: [{ path: "src/new.js", operation: "create", proposed: "new" }],
    });
    expect(cs.operations[0].status).toBe("pending");
  });
});
