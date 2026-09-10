import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLogger,
  setLogLevel,
  addLogHandler,
  sanitize,
  sanitizeContext,
  LEVELS,
  LEVEL_NAMES,
  SENSITIVE_KEYS,
} from "./logger.js";

describe("logger", () => {
  let logs;
  let removeHandler;

  beforeEach(() => {
    logs = [];
    setLogLevel("debug");
    if (removeHandler) removeHandler();
    removeHandler = addLogHandler((entry) => logs.push(entry));
  });

  it("creates a logger with component name", () => {
    const log = createLogger("test");
    expect(log).toHaveProperty("debug");
    expect(log).toHaveProperty("info");
    expect(log).toHaveProperty("warn");
    expect(log).toHaveProperty("error");
    expect(log).toHaveProperty("child");
  });

  it("logs messages at each level", () => {
    const log = createLogger("test");
    log.debug("debug msg");
    log.info("info msg");
    log.warn("warn msg");
    log.error("error msg");
    expect(logs).toHaveLength(4);
    expect(logs[0].level).toBe("DEBUG");
    expect(logs[1].level).toBe("INFO");
    expect(logs[2].level).toBe("WARN");
    expect(logs[3].level).toBe("ERROR");
  });

  it("attaches version and environment", () => {
    const log = createLogger("test");
    log.info("hello");
    expect(logs[0]).toHaveProperty("version");
    expect(logs[0]).toHaveProperty("environment");
    expect(logs[0]).toHaveProperty("timestamp");
    expect(logs[0]).toHaveProperty("component", "test");
  });

  it("respects log level filtering", () => {
    setLogLevel("warn");
    const log = createLogger("test");
    log.debug("no");
    log.info("no");
    log.warn("yes");
    log.error("yes");
    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe("WARN");
  });

  it("sanitizes sensitive keys in context", () => {
    const log = createLogger("test");
    log.info("msg", { secret: "abc123", token: "xyz", normal: "ok" });
    expect(logs[0].context.secret).toBe("[REDACTED]");
    expect(logs[0].context.token).toBe("[REDACTED]");
    expect(logs[0].context.normal).toBe("ok");
  });

  it("truncates long strings", () => {
    const log = createLogger("test");
    log.info("msg", { data: "x".repeat(1000) });
    expect(logs[0].context.data.length).toBeLessThan(1000);
  });

  it("supports child loggers", () => {
    const parent = createLogger("parent");
    const child = parent.child("child");
    child.info("from child");
    expect(logs[0].component).toBe("parent:child");
  });

  it("sanitize handles null and undefined", () => {
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(undefined);
    expect(sanitize(42)).toBe(42);
    expect(sanitize(true)).toBe(true);
  });

  it("sanitizeContext redacts all sensitive keys", () => {
    const ctx = {};
    for (const key of SENSITIVE_KEYS) {
      ctx[key] = "sensitive";
    }
    const result = sanitizeContext(ctx);
    for (const key of SENSITIVE_KEYS) {
      expect(result[key]).toBe("[REDACTED]");
    }
  });

  it("LEVELS and LEVEL_NAMES are consistent", () => {
    expect(LEVEL_NAMES).toHaveLength(4);
    expect(LEVEL_NAMES[LEVELS.DEBUG]).toBe("DEBUG");
    expect(LEVEL_NAMES[LEVELS.INFO]).toBe("INFO");
    expect(LEVEL_NAMES[LEVELS.WARN]).toBe("WARN");
    expect(LEVEL_NAMES[LEVELS.ERROR]).toBe("ERROR");
  });

  it("does not crash on circular context", () => {
    const log = createLogger("test");
    const circular = {};
    circular.self = circular;
    expect(() => log.info("msg", circular)).not.toThrow();
  });

  it("does not crash on context with throwing getter", () => {
    const log = createLogger("test");
    const bad = {};
    Object.defineProperty(bad, "crash", {
      get() {
        throw new Error("getter crash");
      },
    });
    expect(() => log.info("msg", bad)).not.toThrow();
  });

  it("does not crash on null/undefined context", () => {
    const log = createLogger("test");
    expect(() => log.info("msg", null)).not.toThrow();
    expect(() => log.info("msg", undefined)).not.toThrow();
  });

  it("sanitize handles Error objects without crashing", () => {
    const err = new Error("test");
    const result = sanitize(err);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("sanitize handles deeply nested objects", () => {
    const deep = { a: { b: { c: { d: { e: "f" } } } } };
    const result = sanitize(deep);
    expect(result).toHaveProperty("a");
  });
});
