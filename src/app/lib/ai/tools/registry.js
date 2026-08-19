import { createTool } from "./tool";

export function createToolRegistry() {
  const tools = new Map();

  function registerTool(definition) {
    const tool = createTool(definition);
    if (tools.has(tool.id)) {
      throw new Error(`Tool "${tool.id}" is already registered.`);
    }
    tools.set(tool.id, tool);
    return tool;
  }

  function getTool(id) {
    return typeof id === "string" ? tools.get(id) || null : null;
  }

  function listTools() {
    return Array.from(tools.values());
  }

  function hasTool(id) {
    return typeof id === "string" && tools.has(id);
  }

  function clear() {
    tools.clear();
  }

  return { registerTool, getTool, listTools, hasTool, clear };
}