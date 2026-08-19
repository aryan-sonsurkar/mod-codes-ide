import { describe, it, expect } from "vitest";
import {
  PERMISSION_LEVELS,
  PERMISSION_ORDER,
  AUTO_SAFE_LEVEL,
  permissionAllows,
  validateArgs,
  createTool,
  createToolRegistry,
  executeToolCall,
  BUILTIN_READONLY_TOOLS,
  getBuiltinTool,
} from "./index";

describe("permission levels", () => {
  it("defines read/write/execute/destructive in ascending order", () => {
    expect(PERMISSION_ORDER).toEqual([
      "read",
      "write",
      "execute",
      "destructive",
    ]);
    expect(PERMISSION_LEVELS.read).toBe("read");
    expect(PERMISSION_LEVELS.write).toBe("write");
    expect(PERMISSION_LEVELS.execute).toBe("execute");
    expect(PERMISSION_LEVELS.destructive).toBe("destructive");
  });

  it("defaults the automatic level to read", () => {
    expect(AUTO_SAFE_LEVEL).toBe("read");
  });

  it("allows only same or lower levels", () => {
    expect(permissionAllows("read", "read")).toBe(true);
    expect(permissionAllows("read", "write")).toBe(false);
    expect(permissionAllows("read", "destructive")).toBe(false);
    expect(permissionAllows("write", "read")).toBe(true);
    expect(permissionAllows("write", "write")).toBe(true);
    expect(permissionAllows("write", "execute")).toBe(false);
    expect(permissionAllows("destructive", "destructive")).toBe(true);
    expect(permissionAllows("execute", "write")).toBe(true);
  });

  it("rejects unknown levels", () => {
    expect(permissionAllows("admin", "read")).toBe(false);
    expect(permissionAllows("read", "root")).toBe(false);
  });
});

describe("validateArgs", () => {
  const parameters = {
    type: "object",
    properties: {
      path: { type: "string" },
      depth: { type: "number" },
      recursive: { type: "boolean" },
      tags: { type: "array" },
      meta: { type: "object" },
      level: { type: "string", enum: ["info", "warning", "error"] },
    },
    required: ["path"],
  };

  it("accepts valid arguments", () => {
    expect(
      validateArgs(parameters, { path: "/a/b.js", depth: 2 })
    ).toEqual([]);
  });

  it("flags a missing required argument", () => {
    const errors = validateArgs(parameters, { depth: 1 });
    expect(errors).toContain("Missing required argument: path");
  });

  it("flags type mismatches", () => {
    const errors = validateArgs(parameters, {
      path: "/a",
      depth: "deep",
      recursive: "yes",
    });
    expect(errors).toContain('Argument "depth" must be a number.');
    expect(errors).toContain('Argument "recursive" must be a boolean.');
  });

  it("flags values outside an enum", () => {
    const errors = validateArgs(parameters, { path: "/a", level: "fatal" });
    expect(errors).toContain('Argument "level" has an invalid value.');
  });

  it("accepts valid enum values", () => {
    expect(
      validateArgs(parameters, { path: "/a", level: "warning" })
    ).toEqual([]);
  });

  it("ignores missing optional arguments", () => {
    expect(validateArgs(parameters, { path: "/a" })).toEqual([]);
  });

  it("handles empty parameters and args", () => {
    expect(validateArgs({}, {})).toEqual([]);
    expect(validateArgs(undefined, undefined)).toEqual([]);
  });
});

describe("createTool", () => {
  it("builds a valid read-only tool by default", () => {
    const tool = createTool({
      id: "demo.lookup",
      name: "Lookup",
      execute: async () => "ok",
    });
    expect(tool.id).toBe("demo.lookup");
    expect(tool.name).toBe("Lookup");
    expect(tool.permission).toBe("read");
    expect(tool.readOnly).toBe(true);
  });

  it("requires an id, name, and execute function", () => {
    expect(() => createTool({ name: "x", execute: async () => {} })).toThrow(
      /requires an id/
    );
    expect(() => createTool({ id: "x", execute: async () => {} })).toThrow(
      /requires a name/
    );
    expect(() => createTool({ id: "x", name: "X" })).toThrow(
      /requires an execute function/
    );
  });

  it("rejects invalid permission levels", () => {
    expect(() =>
      createTool({
        id: "x",
        name: "X",
        permission: "admin",
        execute: async () => {},
      })
    ).toThrow(/invalid permission/);
  });

  it("marks write tools as not read-only", () => {
    const tool = createTool({
      id: "demo.write",
      name: "Write",
      permission: "write",
      execute: async () => {},
    });
    expect(tool.readOnly).toBe(false);
  });
});

describe("createToolRegistry", () => {
  it("registers, finds, lists, and checks tools", () => {
    const registry = createToolRegistry();
    const tool = registry.registerTool({
      id: "demo.read",
      name: "Read",
      execute: async () => "data",
    });
    expect(registry.hasTool("demo.read")).toBe(true);
    expect(registry.hasTool("nope")).toBe(false);
    expect(registry.getTool("demo.read")).toBe(tool);
    expect(registry.getTool("nope")).toBeNull();
    expect(registry.listTools().map((t) => t.id)).toEqual(["demo.read"]);
  });

  it("rejects duplicate registrations", () => {
    const registry = createToolRegistry();
    registry.registerTool({ id: "a", name: "A", execute: async () => {} });
    expect(() =>
      registry.registerTool({ id: "a", name: "B", execute: async () => {} })
    ).toThrow(/already registered/);
  });

  it("clears all tools", () => {
    const registry = createToolRegistry();
    registry.registerTool({ id: "a", name: "A", execute: async () => {} });
    registry.clear();
    expect(registry.listTools()).toEqual([]);
    expect(registry.hasTool("a")).toBe(false);
  });
});

describe("executeToolCall", () => {
  function makeRegistry() {
    const registry = createToolRegistry();
    registry.registerTool({
      id: "demo.read",
      name: "Read",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
      execute: async (args) => `content of ${args.path}`,
    });
    registry.registerTool({
      id: "demo.write",
      name: "Write",
      permission: "write",
      execute: async () => "written",
    });
    registry.registerTool({
      id: "demo.boom",
      name: "Boom",
      execute: async () => {
        throw new Error("boom");
      },
    });
    return registry;
  }

  it("executes an allowed tool with valid arguments", async () => {
    const result = await executeToolCall({
      registry: makeRegistry(),
      toolName: "demo.read",
      args: { path: "/a.js" },
    });
    expect(result).toEqual({ ok: true, result: "content of /a.js" });
  });

  it("rejects unknown tools", async () => {
    const result = await executeToolCall({
      registry: makeRegistry(),
      toolName: "demo.missing",
      args: {},
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("toolNotFound");
  });

  it("rejects write tools under read permission", async () => {
    const result = await executeToolCall({
      registry: makeRegistry(),
      toolName: "demo.write",
      args: {},
      permission: "read",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("permissionDenied");
  });

  it("never runs a destructive tool automatically", async () => {
    const registry = makeRegistry();
    registry.registerTool({
      id: "demo.delete",
      name: "Delete",
      permission: "destructive",
      execute: async () => "deleted",
    });
    const result = await executeToolCall({
      registry,
      toolName: "demo.delete",
      args: {},
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("permissionDenied");
  });

  it("does not execute with invalid arguments", async () => {
    const result = await executeToolCall({
      registry: makeRegistry(),
      toolName: "demo.read",
      args: {},
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalidArguments");
  });

  it("returns a normalized error when execution throws", async () => {
    const result = await executeToolCall({
      registry: makeRegistry(),
      toolName: "demo.boom",
      args: {},
    });
    expect(result).toEqual({ ok: false, code: "executionFailed", error: "boom" });
  });

  it("requires a registry", async () => {
    const result = await executeToolCall({ toolName: "demo.read", args: {} });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalidRegistry");
  });
});

describe("built-in read-only tools", () => {
  it("defines only read-permission tools", () => {
    expect(BUILTIN_READONLY_TOOLS.length).toBeGreaterThan(0);
    for (const tool of BUILTIN_READONLY_TOOLS) {
      expect(tool.permission).toBe("read");
      expect(tool.readOnly).toBe(true);
      expect(typeof tool.id).toBe("string");
      expect(typeof tool.name).toBe("string");
    }
  });

  it("exposes lookups by id", () => {
    expect(getBuiltinTool("ide.current-file")).toEqual(
      expect.objectContaining({ id: "ide.current-file" })
    );
    expect(getBuiltinTool("nope")).toBeNull();
  });

  it("includes the expected read-only tools", () => {
    const ids = BUILTIN_READONLY_TOOLS.map((tool) => tool.id);
    expect(ids).toContain("ide.current-file");
    expect(ids).toContain("ide.diagnostics");
    expect(ids).toContain("ide.open-files");
  });
});
