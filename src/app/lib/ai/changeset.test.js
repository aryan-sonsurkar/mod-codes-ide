import { describe, expect, it } from "vitest";
import { CHANGESET_OPERATIONS, createChangeset, approveOperation, rejectOperation, changesetSummary } from "./changeset";

describe("changeset", () => {
  it("creates operations with pending status", () => {
    const cs = createChangeset({
      title: "Test",
      operations: [
        { path: "src/a.js", operation: CHANGESET_OPERATIONS.modify, original: "a", proposed: "b", reason: "improve" },
        { path: "src/b.js", operation: CHANGESET_OPERATIONS.create, proposed: "new" },
      ],
    });
    expect(cs.operations).toHaveLength(2);
    expect(changesetSummary(cs).pending).toBe(2);
  });

  it("approves and rejects operations", () => {
    const cs = createChangeset({
      operations: [{ path: "src/a.js", operation: "modify", original: "a", proposed: "b" }],
    });
    const id = cs.operations[0].id;
    const approved = approveOperation(cs, id);
    expect(approved.operations[0].status).toBe("approved");
    const rejected = rejectOperation(approved, id);
    expect(rejected.operations[0].status).toBe("rejected");
  });

  it("proposes create/delete/rename without auto-execute", () => {
    const cs = createChangeset({
      operations: [
        { path: "src/new.js", operation: CHANGESET_OPERATIONS.create, proposed: "content" },
        { path: "src/old.js", operation: CHANGESET_OPERATIONS.delete, original: "old" },
      ],
    });
    expect(cs.operations.every((op) => op.status === "pending")).toBe(true);
  });
});
