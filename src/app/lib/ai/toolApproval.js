import { PERMISSION_LEVELS, permissionAllows } from "./tools";

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

export function approvalRequestFor({ toolName, permission, args = {}, reason = null }) {
  return {
    toolName,
    permission: permission || PERMISSION_LEVELS.read,
    args,
    reason: reason || `The model requested to use ${toolName}`,
    requiresApproval: requiresApproval(permission),
  };
}

export function canAutoRun(permission, policyLevel = "read") {
  return permissionAllows(permission, policyLevel);
}
