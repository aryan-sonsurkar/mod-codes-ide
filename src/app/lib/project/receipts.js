"use client";

export const RECEIPT_KINDS = ["run", "test", "lint", "verification"];

let nextReceiptId = 0;

export function resetReceiptIdsForTests() {
  nextReceiptId = 0;
}

export function createReceipt({
  kind = "run",
  ok = false,
  skipped = false,
  summary = "",
  path = null,
  output = "",
  proposed = false,
  changesetId = null,
  durationMs = null,
  exitCode = null,
} = {}) {
  if (!RECEIPT_KINDS.includes(kind)) {
    throw new TypeError(`Invalid receipt kind: ${kind}`);
  }
  return {
    id: `rcp-${nextReceiptId++}-${Date.now()}`,
    kind,
    ok: Boolean(ok),
    skipped: Boolean(skipped),
    summary: String(summary || ""),
    path: typeof path === "string" && path.length > 0 ? path : null,
    output: String(output || ""),
    proposed: Boolean(proposed),
    changesetId: typeof changesetId === "string" && changesetId.length > 0 ? changesetId : null,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    exitCode: Number.isFinite(exitCode) ? exitCode : null,
    at: Date.now(),
  };
}

export function receiptFromRunOutcome({
  path,
  ok,
  skipped = false,
  reason = null,
  exitCode = null,
  durationMs = null,
  output = "",
} = {}) {
  const detail = reason ? String(reason).trim() : "";
  let summary;
  if (skipped) {
    summary = detail ? `nothing to run: ${detail}` : "nothing to run";
  } else if (ok) {
    summary = Number.isFinite(exitCode) ? `passed (exit ${exitCode})` : "passed";
  } else if (detail) {
    summary = `failed: ${detail}`;
  } else if (Number.isFinite(exitCode)) {
    summary = `failed (exit ${exitCode})`;
  } else {
    summary = "failed";
  }
  return createReceipt({
    kind: "run",
    ok: Boolean(ok),
    skipped: Boolean(skipped),
    summary,
    path,
    exitCode,
    durationMs,
    output,
  });
}

export function receiptsForChangeset(receipts, changesetId) {
  if (!changesetId) return [];
  return (Array.isArray(receipts) ? receipts : []).filter(
    (receipt) => receipt && receipt.changesetId === changesetId
  );
}

function requiredOperations(changeset) {
  return (changeset?.operations || []).filter(
    (op) => typeof op.proposed === "string" && op.proposed !== null
  );
}

export function verifyChangesetAccept({ changeset, receipts } = {}) {
  const required = requiredOperations(changeset);
  if (required.length === 0) {
    return {
      ok: true,
      reason: "No executable changes to verify.",
      missing: [],
      failedReceipt: null,
      covering: [],
    };
  }
  const changesetId = changeset?.id || null;
  const createdAt = Number.isFinite(changeset?.createdAt) ? changeset.createdAt : 0;
  const matching = (Array.isArray(receipts) ? receipts : []).filter((receipt) => {
    if (!receipt) return false;
    if (!receipt.proposed) return false;
    if (changesetId) return receipt.changesetId === changesetId;
    // Fallback for changesets without an id: proposed receipts at/after creation.
    return receipt.changesetId == null && receipt.at >= createdAt;
  });
  const covering = matching.filter((receipt) => receipt.ok);
  const missing = [];
  let failedReceipt = null;
  for (const op of required) {
    const forPath = matching.filter((receipt) => receipt.path === op.path);
    if (forPath.some((receipt) => receipt.ok)) continue;
    if (forPath.length > 0) {
      if (!failedReceipt) failedReceipt = forPath[forPath.length - 1];
    } else {
      missing.push(op.path);
    }
  }
  if (failedReceipt) {
    return {
      ok: false,
      reason: `Verification failed for ${failedReceipt.path || "change"}: ${failedReceipt.summary}`,
      missing,
      failedReceipt,
      covering,
    };
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Not verified yet: ${missing.join(", ")}. Run the changes before accepting.`,
      missing,
      failedReceipt: null,
      covering,
    };
  }
  return {
    ok: true,
    reason: "All changes verified.",
    missing: [],
    failedReceipt: null,
    covering,
  };
}
