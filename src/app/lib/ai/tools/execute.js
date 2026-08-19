import { AUTO_SAFE_LEVEL, permissionAllows, validateArgs } from "./tool";

export async function executeToolCall({
  registry,
  toolName,
  args = {},
  permission = AUTO_SAFE_LEVEL,
}) {
  if (!registry || typeof registry.getTool !== "function") {
    return { ok: false, code: "invalidRegistry", error: "A tool registry is required." };
  }

  const tool = registry.getTool(toolName);
  if (!tool) {
    return {
      ok: false,
      code: "toolNotFound",
      error: `Unknown tool: ${toolName}`,
    };
  }

  if (!permissionAllows(permission, tool.permission)) {
    return {
      ok: false,
      code: "permissionDenied",
      error: `Tool "${toolName}" requires ${tool.permission} permission, which is not allowed here.`,
    };
  }

  const errors = validateArgs(tool.parameters, args);
  if (errors.length > 0) {
    return { ok: false, code: "invalidArguments", error: errors.join(" ") };
  }

  try {
    const result = await tool.execute(args);
    const normalized =
      typeof result === "string" ? result : result == null ? "" : result;
    return { ok: true, result: normalized };
  } catch (error) {
    return {
      ok: false,
      code: "executionFailed",
      error:
        error && typeof error.message === "string"
          ? error.message
          : "Tool execution failed.",
    };
  }
}