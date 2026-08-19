import { describe, expect, it } from "vitest";
import { friendlyError } from "./messages";

describe("friendlyError", () => {
  it("maps known statuses to friendly messages", () => {
    expect(friendlyError("unsupported")).toContain("File System Access API");
    expect(friendlyError("cancelled")).toContain("cancelled");
    expect(friendlyError("denied")).toContain("permission");
    expect(friendlyError("missing")).toContain("no longer available");
    expect(friendlyError("too-large")).toContain("too large");
    expect(friendlyError("binary")).toContain("text");
  });

  it("falls back for unknown statuses", () => {
    expect(friendlyError("something-else")).toContain("failed");
    expect(friendlyError()).toContain("failed");
  });
});