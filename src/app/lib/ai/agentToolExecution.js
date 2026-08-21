import { permissionAllows, PERMISSION_LEVELS, executeToolCall } from "./tools";

export async function executeAgentTool({ registry, toolName, args = {}, signal } = {}) {
  if (!registry || typeof registry.getTool !== "function") {
    throw new TypeError("Tool registry is required");
  }
  if (signal && signal.aborted) {
    const error = new Error("Generation stopped.");
    error.code = "cancelled";
    throw error;
  }
  const tool = registry.getTool(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  if (tool.permission !== PERMISSION_LEVELS.read) {
    // Only read tools auto-execute
    const error = new Error(`Tool ${toolName} requires approval (permission: ${tool.permission})`);
    error.code = "approvalRequired";
    error.permission = tool.permission;
    throw error;
  }
  if (!permissionAllows(tool.permission, PERMISSION_LEVELS.read)) {
    throw new Error(`Permission denied for ${toolName}`);
  }
  // Never call implementation directly — go through registry + permission layer
  return executeToolCall({ registry, toolName, args, permission: "read" });
}
