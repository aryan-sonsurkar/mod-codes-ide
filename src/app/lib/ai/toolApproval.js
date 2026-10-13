import { PERMISSION_LEVELS, permissionAllows } from "./tools";
import { describeProtectedPath } from "./protectedPaths";

export function requiresApproval(permission, policyLevel = "read") {
  if (permission === PERMISSION_LEVELS.read) {
    return false;
  }
  if (permission === PERMISSION_LEVELS.write) {
    return true;
  }
  if (permission === PERMISSION_LEVELS.destructive) {
    return true;
  }
  if (permission === PERMISSION_LEVELS.execute) {
    return true;
  }
  return true;
}

let nextApprovalId = 0;

export function resetApprovalIdsForTests() {
  nextApprovalId = 0;
}

export function approvalRequestFor({ toolName, permission, args = {}, reason = null }) {
  const targetPath = typeof args.path === "string" ? args.path : null;
  const protectedReason = targetPath ? describeProtectedPath(targetPath) : null;
  // Protected files always demand a human, even for read-class tools: reading
  // .env via an API-backed provider would send secrets to the model.
  const needsApproval = requiresApproval(permission) || Boolean(protectedReason);
  return {
    id: `apr-${nextApprovalId++}-${Date.now()}`,
    toolName,
    permission: permission || PERMISSION_LEVELS.read,
    args,
    reason: reason || `The model requested to use ${toolName}`,
    requiresApproval: needsApproval,
    protected: Boolean(protectedReason),
    protectedReason,
    protectedPath: protectedReason ? targetPath : null,
  };
}

export function canAutoRun(permission, policyLevel = "read") {
  return permissionAllows(permission, policyLevel);
}
