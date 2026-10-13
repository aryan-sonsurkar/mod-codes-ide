import { describe, it, expect, beforeEach } from "vitest";
import { createChangeset, resetChangesetIdsForTests } from "../ai/changeset";
import {
  createReceipt,
  receiptFromRunOutcome,
  receiptsForChangeset,
  verifyChangesetAccept,
  resetReceiptIdsForTests,
} from "./receipts";

function proposedReceipt({ changesetId, path, ok = true, skipped = false, summary = "" }) {
  return createReceipt({
    kind: "run",
    ok,
    skipped,
    summary: summary || (ok ? "passed (exit 0)" : "failed (exit 1)"),
    path,
    proposed: true,
    changesetId,
    exitCode: ok ? 0 : 1,
  });
}

describe("receipts", () => {
  beforeEach(() => {
    resetChangesetIdsForTests();
    resetReceiptIdsForTests();
  });

  it("builds honest run summaries from outcomes", () => {
    expect(receiptFromRunOutcome({ path: "a.js", ok: true, exitCode: 0 }).summary).toBe(
      "passed (exit 0)"
    );
    expect(
      receiptFromRunOutcome({ path: "a.md", ok: true, skipped: true, reason: "not a program" })
        .summary
    ).toBe("nothing to run: not a program");
    expect(
      receiptFromRunOutcome({ path: "a.js", ok: false, reason: "TypeError: boom" }).summary
    ).toBe("failed: TypeError: boom");
  });

  it("rejects invalid receipt kinds", () => {
    expect(() => createReceipt({ kind: "vibes" })).toThrow();
  });

  it("blocks acceptance when nothing has been verified", () => {
    const changeset = createChangeset({
      operations: [{ path: "src/app.js", proposed: "console.log(1)" }],
    });
    const result = verifyChangesetAccept({ changeset, receipts: [] });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["src/app.js"]);
    expect(result.reason).toContain("Not verified yet");
  });

  it("allows acceptance once a passing proposed receipt covers every path", () => {
    const changeset = createChangeset({
      operations: [
        { path: "src/app.js", proposed: "a" },
        { path: "src/b.js", proposed: "b" },
      ],
    });
    const receipts = [
      proposedReceipt({ changesetId: changeset.id, path: "src/app.js" }),
      proposedReceipt({ changesetId: changeset.id, path: "src/b.js" }),
    ];
    const result = verifyChangesetAccept({ changeset, receipts });
    expect(result.ok).toBe(true);
    expect(result.covering.length).toBe(2);
  });

  it("blocks on a failed receipt and surfaces its summary", () => {
    const changeset = createChangeset({
      operations: [{ path: "src/app.js", proposed: "broken" }],
    });
    const receipts = [
      proposedReceipt({
        changesetId: changeset.id,
        path: "src/app.js",
        ok: false,
        summary: "failed (exit 1)",
      }),
    ];
    const result = verifyChangesetAccept({ changeset, receipts });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Verification failed");
    expect(result.reason).toContain("failed (exit 1)");
    expect(result.failedReceipt).toBe(receipts[0]);
  });

  it("treats non-runnable files as verified when skipped receipts pass", () => {
    const changeset = createChangeset({
      operations: [{ path: "README.md", proposed: "# docs" }],
    });
    const receipts = [
      proposedReceipt({
        changesetId: changeset.id,
        path: "README.md",
        ok: true,
        skipped: true,
        summary: "nothing to run",
      }),
    ];
    expect(verifyChangesetAccept({ changeset, receipts }).ok).toBe(true);
  });

  it("only counts receipts from the current changeset", () => {
    const changeset = createChangeset({
      operations: [{ path: "src/app.js", proposed: "a" }],
    });
    const stale = proposedReceipt({ changesetId: "cs-old", path: "src/app.js" });
    const result = verifyChangesetAccept({ changeset, receipts: [stale] });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["src/app.js"]);
  });

  it("ignores manual (non-proposed) runs for the gate", () => {
    const changeset = createChangeset({
      operations: [{ path: "src/app.js", proposed: "a" }],
    });
    const manual = createReceipt({
      kind: "run",
      ok: true,
      summary: "passed (exit 0)",
      path: "src/app.js",
      proposed: false,
      changesetId: changeset.id,
    });
    expect(verifyChangesetAccept({ changeset, receipts: [manual] }).ok).toBe(false);
  });

  it("allows delete-only changesets with nothing executable to run", () => {
    const changeset = createChangeset({
      operations: [{ path: "old.js", operation: "delete", proposed: null }],
    });
    const result = verifyChangesetAccept({ changeset, receipts: [] });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("filters receipts by changeset id", () => {
    const a = proposedReceipt({ changesetId: "cs-1", path: "a.js" });
    const b = proposedReceipt({ changesetId: "cs-2", path: "b.js" });
    expect(receiptsForChangeset([a, b], "cs-1")).toEqual([a]);
    expect(receiptsForChangeset([a, b], null)).toEqual([]);
  });
});
