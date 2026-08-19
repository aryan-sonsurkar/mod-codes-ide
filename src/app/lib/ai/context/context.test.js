import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_BUDGET,
  buildBudget,
  buildContext,
  buildContextPreview,
  clampBudget,
  estimatedTokens,
  isSecretPath,
  excludeSecretPaths,
} from "./index";

describe("secrets", () => {
  it("flags likely secret files", () => {
    for (const path of [
      ".env",
      ".env.local",
      "config/.env.production",
      "keys/id_rsa",
      "secrets.json",
      "credentials.txt",
      "cert.pem",
      "client.p12",
      ".git-credentials",
    ]) {
      expect(isSecretPath(path), path).toBe(true);
    }
  });

  it("does not flag ordinary source files", () => {
    for (const path of [
      "src/a.js",
      "package.json",
      "env.example.js",
      "src/credentials.js",
      "docs/keys.md",
    ]) {
      expect(isSecretPath(path), path).toBe(false);
    }
  });

  it("filters secret paths out of a list", () => {
    expect(excludeSecretPaths(["a.js", ".env", "b.ts", ".env.local"])).toEqual([
      "a.js",
      "b.ts",
    ]);
  });
});

describe("budget", () => {
  it("clamps to min/max", () => {
    expect(clampBudget(100)).toBe(2000);
    expect(clampBudget(999999)).toBe(200000);
    expect(clampBudget(12000)).toBe(12000);
    expect(clampBudget(undefined)).toBe(DEFAULT_CONTEXT_BUDGET);
  });

  it("builds a budget with reserved space", () => {
    const budget = buildBudget({ budget: 10000, reserved: 2000 });
    expect(budget.total).toBe(10000);
    expect(budget.remaining).toBe(8000);
  });

  it("estimates tokens conservatively", () => {
    expect(estimatedTokens(100)).toBe(25);
  });
});

describe("buildContext", () => {
  const request = {
    currentFile: { path: "src/app.js", content: "export const A = 1;" },
    selection: { path: "src/app.js", text: "const B = 2;", startLine: 5, endLine: 5 },
    openDocuments: [
      { path: "src/util.js", content: "export function util() {}", name: "util.js" },
    ],
    diagnostics: [
      { path: "src/app.js", severity: "error", message: "Syntax error", line: 2 },
    ],
    graph: {
      nodes: [{ path: "src/app.js" }, { path: "src/util.js" }],
      edges: [{ from: "src/app.js", to: "src/util.js" }],
    },
    symbols: [{ path: "src/app.js", symbols: [{ name: "A", kind: "variable", line: 1 }] }],
  };

  it("includes high-priority sources and orders selection first", () => {
    const context = buildContext(request);

    expect(context.items.length).toBeGreaterThanOrEqual(5);
    expect(context.items[0].type).toBe("selection");
    expect(context.items[1].type).toBe("current_file");
  });

  it("bounded by budget, truncating the current file when needed", () => {
    const bigFile = { path: "src/big.js", content: "x".repeat(20000) };
    const context = buildContext({
      currentFile: bigFile,
      budget: 4000,
    });

    expect(context.budget).toBe(4000);
    expect(context.used).toBeLessThanOrEqual(4000);
    expect(context.items[0].truncated).toBe(true);
    expect(context.items[0].content.length).toBeLessThanOrEqual(4000);
  });

  it("drops low-priority items when the budget is exhausted", () => {
    const context = buildContext({
      currentFile: { path: "src/big.js", content: "x".repeat(20000) },
      openDocuments: [{ path: "src/other.js", content: "y".repeat(10000) }],
      budget: 5000,
    });

    const open = context.items.find((item) => item.type === "open_document");
    expect(open).toBeUndefined();
  });

  it("excludes secret files entirely", () => {
    const context = buildContext({
      currentFile: { path: ".env", content: "SECRET=1" },
      explicitFiles: [{ path: "creds.pem", content: "private" }],
    });

    expect(context.items).toHaveLength(0);
  });

  it("honors enabled source filtering", () => {
    const context = buildContext({
      ...request,
      sources: ["selection"],
    });

    expect(context.items).toHaveLength(1);
    expect(context.items[0].type).toBe("selection");
  });

  it("handles empty requests", () => {
    const context = buildContext({});
    expect(context.items).toEqual([]);
    expect(context.used).toBe(0);
  });
});

describe("buildContextPreview", () => {
  const context = buildContext({
    currentFile: { path: "src/app.js", content: "abc" },
    selection: { path: "src/app.js", text: "def" },
    diagnostics: [
      { path: "src/app.js", severity: "error", message: "x", line: 1 },
    ],
  });

  it("summarizes sections, files and budget usage", () => {
    const preview = buildContextPreview(context);

    expect(preview.sections.find((s) => s.type === "selection").count).toBe(1);
    expect(preview.sections.find((s) => s.type === "diagnostics").count).toBe(1);
    expect(preview.filesCount).toBeGreaterThanOrEqual(1);
    expect(preview.totalChars).toBeGreaterThan(0);
    expect(preview.budget).toBe(context.budget);
  });
});