import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureError,
  getRecentErrors,
  getErrorCount,
  clearErrors,
  addErrorHandler,
  sanitizeStack,
  classifySeverity,
} from "./errorCollector.js";
import { addLogHandler } from "./logger.js";

describe("errorCollector", () => {
  let removeHandler;

  beforeEach(() => {
    clearErrors();
    if (removeHandler) removeHandler();
    removeHandler = null;
  });

  it("captures an error and returns entry", () => {
    const entry = captureError(new Error("test error"), { component: "test" });
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("message", "test error");
    expect(entry).toHaveProperty("severity", "error");
    expect(entry).toHaveProperty("context");
    expect(entry.context.component).toBe("test");
  });

  it("stores errors in ring buffer", () => {
    captureError(new Error("e1"));
    captureError(new Error("e2"));
    captureError(new Error("e3"));
    expect(getErrorCount()).toBe(3);
    const recent = getRecentErrors(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].message).toBe("e2");
  });

  it("limits stored errors to MAX_ERRORS", () => {
    for (let i = 0; i < 60; i++) {
      captureError(new Error(`err${i}`));
    }
    expect(getErrorCount()).toBeLessThanOrEqual(50);
  });

  it("clears errors", () => {
    captureError(new Error("e1"));
    clearErrors();
    expect(getErrorCount()).toBe(0);
  });

  it("notifies error handlers", () => {
    const handler = vi.fn();
    removeHandler = addErrorHandler(handler);
    captureError(new Error("test"), { tag: "yes" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ message: "test" })
    );
  });

  it("removes handler on cleanup", () => {
    const handler = vi.fn();
    const cleanup = addErrorHandler(handler);
    cleanup();
    captureError(new Error("test"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("sanitizes stack traces", () => {
    const stack = "Error: test\n    at foo (file.js:1:1)\n    at bar (node_modules/x.js:1:1)\n    at baz (file2.js:2:2)";
    const result = sanitizeStack(stack);
    expect(result).not.toContain("node_modules");
    expect(result).toContain("foo");
  });

  it("classifies severity correctly", () => {
    expect(classifySeverity(new Error("timeout"))).toBe("warn");
    expect(classifySeverity(new Error("cancelled"))).toBe("info");
    expect(classifySeverity(new Error("unknown"))).toBe("error");
    expect(classifySeverity(null)).toBe("error");
  });

  it("captures non-Error objects", () => {
    const entry = captureError("string error");
    expect(entry.message).toBe("string error");
  });

  it("does not crash when handler throws", () => {
    removeHandler = addErrorHandler(() => {
      throw new Error("handler crash");
    });
    expect(() => captureError(new Error("test"))).not.toThrow();
  });

  it("does not crash when logger throws", () => {
    const badRemove = addLogHandler(() => {
      throw new Error("logger crash");
    });
    expect(() => captureError(new Error("test"))).not.toThrow();
    badRemove();
  });

  it("does not crash on null error", () => {
    expect(() => captureError(null)).not.toThrow();
    expect(() => captureError(undefined)).not.toThrow();
  });

  it("does not crash on circular context", () => {
    const circular = {};
    circular.self = circular;
    expect(() => captureError(new Error("test"), circular)).not.toThrow();
  });

  it("ring buffer evicts oldest entries exactly", () => {
    for (let i = 0; i < 55; i++) {
      captureError(new Error(`err${i}`));
    }
    expect(getErrorCount()).toBe(50);
    const recent = getRecentErrors(50);
    expect(recent[0].message).toBe("err5");
    expect(recent[49].message).toBe("err54");
  });

  it("captureError returns entry with all required fields", () => {
    const entry = captureError(new Error("complete"), { tag: "test" });
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("severity");
    expect(entry).toHaveProperty("message");
    expect(entry).toHaveProperty("name");
    expect(entry).toHaveProperty("code");
    expect(entry).toHaveProperty("stack");
    expect(entry).toHaveProperty("context");
    expect(entry).toHaveProperty("version");
    expect(entry).toHaveProperty("environment");
    expect(entry).toHaveProperty("userAgent");
  });
});
