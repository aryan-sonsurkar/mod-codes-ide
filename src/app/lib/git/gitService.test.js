import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../terminal/backends/systemTerminalBackend.js", () => ({
  getBridgeToken: vi.fn(() => "test-token"),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

let sessionCount = 0;

function setupBridge(opts = {}) {
  sessionCount = 0;
  mockFetch.mockImplementation(async (url, init) => {
    const u = typeof url === "string" ? url : url.toString();
    const method = init?.method || "GET";
    if (u.endsWith("/terminals") && method === "POST" && !u.includes("/execute") && !u.includes("/kill")) {
      sessionCount++;
      const id = `s${sessionCount}`;
      return { ok: true, json: async () => ({ ok: true, id }) };
    }
    if (u.includes("/execute")) {
      const body = JSON.parse(init.body || "{}");
      const cmd = body.command || "";
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      if (opts.execute) {
        const r = opts.execute(cmd);
        if (r) {
          stdout = r.stdout || "";
          stderr = r.stderr || "";
          exitCode = r.exitCode ?? 0;
        }
      }
      return { ok: true, json: async () => ({ stdout, stderr, exitCode }) };
    }
    if (u.includes("/kill")) {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

import {
  gitStatus,
  gitStage,
  gitUnstage,
  gitCommit,
  gitBranches,
  gitCheckout,
  gitCreateBranch,
  gitLog,
  gitPush,
  gitPull,
  gitHasChanges,
} from "./gitService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gitService", () => {
  describe("gitStatus", () => {
    it("returns empty list when no changes", async () => {
      setupBridge({
        execute: (cmd) => {
          if (cmd.startsWith("git status")) return { stdout: "" };
          if (cmd.startsWith("git branch")) return { stdout: "main" };
          if (cmd.includes("@{upstream}")) return { stdout: "0" };
          return { stdout: "" };
        },
      });
      const result = await gitStatus();
      expect(result.ok).toBe(true);
      expect(result.files).toEqual([]);
    });

    it("parses status output correctly", async () => {
      setupBridge({
        execute: (cmd) => {
          if (cmd.startsWith("git status"))
            return { stdout: "M  src/file.js\n A new-file.js\n?? untracked.txt\nD  old.js\n" };
          if (cmd.startsWith("git branch")) return { stdout: "main" };
          if (cmd.includes("@{upstream}")) return { stdout: "0" };
          return { stdout: "" };
        },
      });
      const result = await gitStatus();
      expect(result.ok).toBe(true);
      expect(result.files.length).toBe(4);
      expect(result.files[0]).toEqual({
        path: "src/file.js",
        indexStatus: "M",
        workTreeStatus: " ",
      });
      expect(result.files[1]).toEqual({
        path: "new-file.js",
        indexStatus: " ",
        workTreeStatus: "A",
      });
      expect(result.files[2]).toEqual({
        path: "untracked.txt",
        indexStatus: "?",
        workTreeStatus: "?",
      });
    });

    it("returns error when bridge unavailable", async () => {
      const mod = await import("../terminal/backends/systemTerminalBackend.js");
      mod.getBridgeToken.mockReturnValue(null);
      const result = await gitStatus();
      expect(result.ok).toBe(false);
      mod.getBridgeToken.mockReturnValue("test-token");
    });
  });

  describe("gitStage", () => {
    it("stages files successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "" }) });
      const result = await gitStage(["file.js"]);
      expect(result.ok).toBe(true);
    });

    it("returns error with no paths", async () => {
      const result = await gitStage([]);
      expect(result.ok).toBe(false);
    });
  });

  describe("gitUnstage", () => {
    it("unstages files successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "" }) });
      const result = await gitUnstage(["file.js"]);
      expect(result.ok).toBe(true);
    });

    it("returns error with no paths", async () => {
      const result = await gitUnstage(null);
      expect(result.ok).toBe(false);
    });
  });

  describe("gitCommit", () => {
    it("commits successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "[main abc123] fix: test" }) });
      const result = await gitCommit("fix: test commit");
      expect(result.ok).toBe(true);
    });

    it("returns error with empty message", async () => {
      const result = await gitCommit("");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("Commit message is required");
    });

    it("returns error with whitespace message", async () => {
      const result = await gitCommit("   ");
      expect(result.ok).toBe(false);
    });
  });

  describe("gitBranches", () => {
    it("returns branches list", async () => {
      setupBridge({
        execute: (cmd) => {
          if (cmd.includes("git branch")) return { stdout: "main\ndevelop\nfeature/new-feature\n" };
          return { stdout: "" };
        },
      });
      const result = await gitBranches();
      expect(result.ok).toBe(true);
      expect(result.branches).toEqual(["main", "develop", "feature/new-feature"]);
    });
  });

  describe("gitCheckout", () => {
    it("checks out branch successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "Switched to branch 'main'" }) });
      const result = await gitCheckout("main");
      expect(result.ok).toBe(true);
    });

    it("returns error with no branch", async () => {
      const result = await gitCheckout(null);
      expect(result.ok).toBe(false);
    });
  });

  describe("gitCreateBranch", () => {
    it("creates branch successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "Switched to a new branch 'feature/new'" }) });
      const result = await gitCreateBranch("feature/new");
      expect(result.ok).toBe(true);
    });

    it("returns error with no name", async () => {
      const result = await gitCreateBranch("");
      expect(result.ok).toBe(false);
    });
  });

  describe("gitLog", () => {
    it("returns commit log", async () => {
      setupBridge({
        execute: (cmd) => {
          if (cmd.includes("git log"))
            return {
              stdout: "abc123|fix: bug|Jane|2026-01-15\ndef456|feat: new|John|2026-01-14\n",
            };
          return { stdout: "" };
        },
      });
      const result = await gitLog(5);
      expect(result.ok).toBe(true);
      expect(result.entries.length).toBe(2);
      expect(result.entries[0]).toEqual({
        hash: "abc123",
        message: "fix: bug",
        author: "Jane",
        date: "2026-01-15",
      });
    });
  });

  describe("gitPush", () => {
    it("pushes successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "Everything up-to-date" }) });
      const result = await gitPush();
      expect(result.ok).toBe(true);
    });
  });

  describe("gitPull", () => {
    it("pulls successfully", async () => {
      setupBridge({ execute: () => ({ stdout: "Already up to date." }) });
      const result = await gitPull();
      expect(result.ok).toBe(true);
    });
  });

  describe("gitHasChanges", () => {
    it("returns false when clean", async () => {
      setupBridge({ execute: () => ({ stdout: "" }) });
      const result = await gitHasChanges();
      expect(result.ok).toBe(true);
      expect(result.hasChanges).toBe(false);
    });

    it("returns true when dirty", async () => {
      setupBridge({ execute: () => ({ stdout: "M file.js\n" }) });
      const result = await gitHasChanges();
      expect(result.ok).toBe(true);
      expect(result.hasChanges).toBe(true);
    });
  });
});
