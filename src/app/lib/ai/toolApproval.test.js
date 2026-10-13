import { describe, it, expect, beforeEach } from "vitest";
import { approvalRequestFor, requiresApproval, resetApprovalIdsForTests } from "./toolApproval";

describe("toolApproval", () => {
  beforeEach(() => {
    resetApprovalIdsForTests();
  });

  it("still auto-runs plain read tools", () => {
    const request = approvalRequestFor({
      toolName: "ide.read-file",
      permission: "read",
      args: { path: "src/app.js" },
    });
    expect(request.requiresApproval).toBe(false);
    expect(request.protected).toBe(false);
    expect(request.id).toBeTruthy();
  });

  it("forces approval for every write", () => {
    expect(
      approvalRequestFor({ toolName: "ide.write-file", permission: "write", args: {} })
        .requiresApproval
    ).toBe(true);
    expect(requiresApproval("destructive")).toBe(true);
    expect(requiresApproval("execute")).toBe(true);
  });

  it("forces approval for reads of protected files", () => {
    const request = approvalRequestFor({
      toolName: "ide.read-file",
      permission: "read",
      args: { path: ".env" },
    });
    expect(request.requiresApproval).toBe(true);
    expect(request.protected).toBe(true);
    expect(request.protectedPath).toBe(".env");
    expect(request.protectedReason).toMatch(/secrets/i);
  });

  it("marks protected write targets with their reason", () => {
    const request = approvalRequestFor({
      toolName: "ide.write-file",
      permission: "write",
      args: { path: "db/migrations/0002_users.sql" },
    });
    expect(request.requiresApproval).toBe(true);
    expect(request.protected).toBe(true);
    expect(request.protectedReason).toMatch(/migration/i);
  });

  it("does not flag ordinary files", () => {
    const request = approvalRequestFor({
      toolName: "ide.apply-patch",
      permission: "write",
      args: { path: "src/components/Button.jsx" },
    });
    expect(request.protected).toBe(false);
    expect(request.protectedPath).toBeNull();
    expect(request.protectedReason).toBeNull();
  });

  it("issues a fresh id per request", () => {
    const a = approvalRequestFor({ toolName: "t", permission: "read", args: {} });
    const b = approvalRequestFor({ toolName: "t", permission: "read", args: {} });
    expect(a.id).not.toBe(b.id);
  });
});
