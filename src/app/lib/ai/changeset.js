export const CHANGESET_OPERATIONS = {
  modify: "modify",
  create: "create",
  delete: "delete",
  rename: "rename",
};

export const CHANGESET_STATUSES = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  applied: "applied",
  saved: "saved",
  failed: "failed",
};

let nextChangesetId = 0;
let nextOperationId = 0;

export function resetChangesetIdsForTests() {
  nextChangesetId = 0;
  nextOperationId = 0;
}

export function createChangesetOperation({
  id = null,
  path,
  operation = CHANGESET_OPERATIONS.modify,
  original = null,
  proposed = null,
  reason = null,
  status = CHANGESET_STATUSES.pending,
  metadata = null,
} = {}) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Operation requires a path");
  }
  if (!Object.values(CHANGESET_OPERATIONS).includes(operation)) {
    throw new TypeError(`Invalid operation: ${operation}`);
  }
  return {
    id: typeof id === "string" && id.length > 0 ? id : `op-${nextOperationId++}-${Date.now()}`,
    path,
    operation,
    original: typeof original === "string" ? original : null,
    proposed: typeof proposed === "string" ? proposed : null,
    reason: typeof reason === "string" ? reason : null,
    status: Object.values(CHANGESET_STATUSES).includes(status) ? status : CHANGESET_STATUSES.pending,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
  };
}

export function createChangeset({ id = null, title = null, operations = [], metadata = null } = {}) {
  return {
    id: typeof id === "string" && id.length > 0 ? id : `cs-${nextChangesetId++}-${Date.now()}`,
    title: typeof title === "string" && title.length > 0 ? title : "AI changeset",
    operations: Array.isArray(operations) ? operations.map((op) => createChangesetOperation(op)) : [],
    metadata: metadata && typeof metadata === "object" ? metadata : null,
    createdAt: Date.now(),
    status: CHANGESET_STATUSES.pending,
  };
}

export function changesetSummary(changeset) {
  const ops = changeset.operations || [];
  return {
    total: ops.length,
    pending: ops.filter((o) => o.status === CHANGESET_STATUSES.pending).length,
    approved: ops.filter((o) => o.status === CHANGESET_STATUSES.approved).length,
    applied: ops.filter((o) => o.status === CHANGESET_STATUSES.applied).length,
    failed: ops.filter((o) => o.status === CHANGESET_STATUSES.failed).length,
  };
}

export function approveOperation(changeset, operationId) {
  return updateOperation(changeset, operationId, CHANGESET_STATUSES.approved);
}

export function rejectOperation(changeset, operationId) {
  return updateOperation(changeset, operationId, CHANGESET_STATUSES.rejected);
}

export function applyOperation(changeset, operationId) {
  if (changeset.operations.find((op) => op.id === operationId)?.operation === CHANGESET_OPERATIONS.delete) {
    return updateOperation(changeset, operationId, CHANGESET_STATUSES.applied);
  }
  return updateOperation(changeset, operationId, CHANGESET_STATUSES.applied);
}

function updateOperation(changeset, operationId, status) {
  return {
    ...changeset,
    operations: changeset.operations.map((op) => (op.id === operationId ? { ...op, status } : op)),
  };
}

export function creationRequiresApproval(operation) {
  return operation.operation !== CHANGESET_OPERATIONS.modify || true;
}

export function canApply(changeset) {
  return changeset.operations.some((op) => op.status === CHANGESET_STATUSES.approved);
}
