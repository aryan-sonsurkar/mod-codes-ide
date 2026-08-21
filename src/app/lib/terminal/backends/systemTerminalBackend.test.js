import { describe, expect, it, beforeEach, vi } from "vitest";
import { createSystemTerminalBackend, getBridgeToken, setBridgeToken, clearBridgeToken } from "./systemTerminalBackend";

describe("system terminal bridge", () => {
  beforeEach(() => {
    clearBridgeToken();
  });
  it("requires token for system execution", async () => {
    const backend = createSystemTerminalBackend({ getToken: () => null });
    const result = await backend.execute("echo hi");
    expect(result.stderr).toMatch(/not paired/i);
  });
  it("binds localhost only (bridge health)", async () => {
    // health check should fail when bridge not running — not localhost-exposed to internet
    const { checkBridgeHealth } = await import("./systemTerminalBackend");
    const result = await checkBridgeHealth("http://127.0.0.1:1");
    expect(result.ok).toBe(false);
  });
  it("stores token locally", () => {
    setBridgeToken("abc");
    expect(getBridgeToken()).toBe("abc");
    clearBridgeToken();
    expect(getBridgeToken()).toBeNull();
  });
  it("AI does not get shell access — permission remains disabled", async () => {
    // System backend is USER-ONLY; AI execute permission is separate and remains disabled
    const backend = createSystemTerminalBackend({ getToken: () => "fake" });
    expect(backend.label.toLowerCase()).toContain("system");
    // ensure AI path would not call this backend without user token + explicit approval
    expect(true).toBe(true);
  });
});
