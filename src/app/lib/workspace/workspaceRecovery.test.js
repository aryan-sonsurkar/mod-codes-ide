import { describe, expect, it } from "vitest";
import {
  WORKSPACE_VERSION,
  buildRecoveryPlan,
  normalizeWorkspace,
} from "./workspaceRecovery";

describe("normalizeWorkspace", () => {
  it("normalizes, dedupes and stamps the version", () => {
    const result = normalizeWorkspace({
      projectId: "proj-1",
      openTabs: [
        { path: "a.js", name: "a.js" },
        { path: "b.js", name: "b.js" },
        { path: "a.js", name: "a.js" },
      ],
      activePath: "b.js",
    });

    expect(result.projectId).toBe("proj-1");
    expect(result.openTabs).toHaveLength(2);
    expect(result.activePath).toBe("b.js");
    expect(result.version).toBe(WORKSPACE_VERSION);
    expect(typeof result.savedAt).toBe("number");
  });

  it("rejects workspaces without a project id", () => {
    expect(normalizeWorkspace({ openTabs: [] })).toBeNull();
    expect(normalizeWorkspace(null)).toBeNull();
  });

  it("drops malformed entries and falls back the active path", () => {
    const result = normalizeWorkspace({
      projectId: "p",
      openTabs: [{ path: "a.js" }, { path: 42 }, null],
      activePath: "missing.js",
    });

    expect(result.openTabs).toHaveLength(1);
    expect(result.activePath).toBe("a.js");
  });

  it("clamps to MAX_RESTORED_TABS", () => {
    const openTabs = Array.from({ length: 80 }, (_, i) => ({
      path: `f${i}.js`,
      name: `f${i}.js`,
    }));
    const result = normalizeWorkspace({ projectId: "p", openTabs });

    expect(result.openTabs).toHaveLength(50);
  });
});

describe("buildRecoveryPlan", () => {
  const workspace = normalizeWorkspace({
    projectId: "p",
    openTabs: [
      { path: "a.js", name: "a.js" },
      { path: "b.js", name: "b.js" },
    ],
    activePath: "b.js",
  });

  it("filters to files that still exist", () => {
    const plan = buildRecoveryPlan(workspace, new Set(["a.js"]));
    expect(plan.shouldRestore).toBe(true);
    expect(plan.openPaths).toEqual(["a.js"]);
    expect(plan.activePath).toBe("a.js");
  });

  it("skips restore when nothing exists", () => {
    const plan = buildRecoveryPlan(workspace, new Set(["gone.js"]));
    expect(plan.shouldRestore).toBe(false);
  });

  it("handles missing workspace", () => {
    const plan = buildRecoveryPlan(null, new Set(["a.js"]));
    expect(plan.shouldRestore).toBe(false);
  });

  it("returns all paths when no file set is provided", () => {
    const plan = buildRecoveryPlan(workspace, null);
    expect(plan.openPaths).toEqual(["a.js", "b.js"]);
  });
});