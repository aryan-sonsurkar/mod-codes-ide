import { describe, expect, it } from "vitest";
import { executeAgentTool } from "./agentToolExecution";
import { createToolRegistry, createTool } from "./tools";

describe("bounded tool execution", () => {
  it("executes read tools via registry", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({ id: "ide.current-file", name: "Current", permission: "read", execute: async () => "hello" }));
    const result = await executeAgentTool({ registry, toolName: "ide.current-file", args: {} });
    expect(result).toBeDefined();
  });

  it("rejects write tools without approval", async () => {
    const registry = createToolRegistry();
    registry.registerTool(createTool({ id: "write-file", name: "Write", permission: "write", execute: async () => "ok" }));
    await expect(executeAgentTool({ registry, toolName: "write-file" })).rejects.toThrow(/approval/);
  });

  it("never calls implementation directly", async () => {
    let called = false;
    const registry = createToolRegistry();
    registry.registerTool(createTool({ id: "ide.current-file", name: "Current", permission: "read", execute: async () => { called = true; return "ok"; } }));
    await executeAgentTool({ registry, toolName: "ide.current-file" });
    expect(called).toBe(true);
  });
});
