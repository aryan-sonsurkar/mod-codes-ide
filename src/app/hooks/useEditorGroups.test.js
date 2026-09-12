import { describe, it, expect } from "vitest";

function createTab(path) {
  return {
    path,
    name: path.split("/").pop(),
    content: "",
    savedContent: "",
    dirty: false,
    readStatus: "ready",
    readError: "",
    saveStatus: "idle",
    saveError: "",
    fileStatus: "ok",
    contentToken: 0,
  };
}

describe("EditorGroup data model", () => {
  function createGroup(initialPath) {
    return {
      id: 1,
      paths: initialPath ? [initialPath] : [],
      activePath: initialPath || null,
    };
  }

  it("creates an empty group", () => {
    const group = createGroup(null);
    expect(group.paths).toEqual([]);
    expect(group.activePath).toBeNull();
  });

  it("creates a group with initial path", () => {
    const group = createGroup("/a.js");
    expect(group.paths).toEqual(["/a.js"]);
    expect(group.activePath).toBe("/a.js");
  });

  it("adding a file to group appends to paths and sets active", () => {
    let group = createGroup("/a.js");
    group = { ...group, paths: [...group.paths, "/b.js"], activePath: "/b.js" };
    expect(group.paths).toEqual(["/a.js", "/b.js"]);
    expect(group.activePath).toBe("/b.js");
  });

  it("switching active does not change paths", () => {
    let group = createGroup("/a.js");
    group = { ...group, paths: [...group.paths, "/b.js"], activePath: "/b.js" };
    group = { ...group, activePath: "/a.js" };
    expect(group.paths).toEqual(["/a.js", "/b.js"]);
    expect(group.activePath).toBe("/a.js");
  });

  it("closing a file removes it from paths", () => {
    let group = createGroup("/a.js");
    group = { ...group, paths: [...group.paths, "/b.js"], activePath: "/b.js" };
    const paths = group.paths.filter((p) => p !== "/a.js");
    group = { ...group, paths, activePath: group.activePath === "/a.js" ? paths[0] || null : group.activePath };
    expect(group.paths).toEqual(["/b.js"]);
    expect(group.activePath).toBe("/b.js");
  });

  it("closing active file falls back to adjacent", () => {
    let group = createGroup(null);
    group = { ...group, paths: ["/a.js", "/b.js", "/c.js"], activePath: "/b.js" };
    const idx = group.paths.indexOf("/b.js");
    const paths = group.paths.filter((p) => p !== "/b.js");
    const nextIdx = Math.min(idx, paths.length - 1);
    group = { ...group, paths, activePath: paths[nextIdx] };
    expect(group.paths).toEqual(["/a.js", "/c.js"]);
    expect(group.activePath).toBe("/c.js");
  });

  it("closing the only file leaves group empty", () => {
    let group = createGroup("/a.js");
    const paths = group.paths.filter((p) => p !== "/a.js");
    group = { ...group, paths, activePath: null };
    expect(group.paths).toEqual([]);
    expect(group.activePath).toBeNull();
  });

  it("splitting creates a new group with the active path", () => {
    const source = { id: 1, paths: ["/a.js", "/b.js"], activePath: "/a.js" };
    const newGroup = { id: 2, paths: [source.activePath], activePath: source.activePath };
    expect(newGroup.paths).toEqual(["/a.js"]);
    expect(newGroup.activePath).toBe("/a.js");
  });

  it("remapping updates paths and active", () => {
    let group = { id: 1, paths: ["/a.js", "/b.js"], activePath: "/a.js" };
    const paths = group.paths.map((p) => (p === "/a.js" ? "/renamed.js" : p));
    const activePath = group.activePath === "/a.js" ? "/renamed.js" : group.activePath;
    group = { ...group, paths, activePath };
    expect(group.paths).toEqual(["/renamed.js", "/b.js"]);
    expect(group.activePath).toBe("/renamed.js");
  });

  it("dropping a path removes it from group", () => {
    let group = { id: 1, paths: ["/a.js", "/b.js"], activePath: "/a.js" };
    if (group.paths.includes("/a.js")) {
      const paths = group.paths.filter((p) => p !== "/a.js");
      const activePath = group.activePath === "/a.js" ? paths[0] || null : group.activePath;
      group = { ...group, paths, activePath };
    }
    expect(group.paths).toEqual(["/b.js"]);
    expect(group.activePath).toBe("/b.js");
  });

  it("moving a tab between groups", () => {
    const groupA = { id: 1, paths: ["/a.js", "/b.js"], activePath: "/a.js" };
    const groupB = { id: 2, paths: [], activePath: null };

    const path = "/a.js";
    const fromA = {
      ...groupA,
      paths: groupA.paths.filter((p) => p !== path),
      activePath: groupA.activePath === path ? groupA.paths.filter((p) => p !== path)[0] || null : groupA.activePath,
    };
    const toB = {
      ...groupB,
      paths: [...groupB.paths, path],
      activePath: path,
    };

    expect(fromA.paths).toEqual(["/b.js"]);
    expect(fromA.activePath).toBe("/b.js");
    expect(toB.paths).toEqual(["/a.js"]);
    expect(toB.activePath).toBe("/a.js");
  });
});

describe("workspace persistence with groups", () => {
  it("serializes group layout", () => {
    const groups = [
      { id: 1, paths: ["/a.js"], activePath: "/a.js" },
      { id: 2, paths: ["/b.js"], activePath: "/b.js" },
    ];
    const layout = {
      groups: groups.map((g) => ({ id: g.id, paths: g.paths, activePath: g.activePath })),
      focusedGroupId: 1,
      splitDirection: "horizontal",
    };
    expect(layout.groups).toHaveLength(2);
    expect(layout.focusedGroupId).toBe(1);
    expect(layout.splitDirection).toBe("horizontal");
  });

  it("empty group defaults to single group on restore", () => {
    const saved = {
      groups: [],
      focusedGroupId: null,
      splitDirection: "horizontal",
    };
    const restored = saved.groups.length > 0 ? saved.groups : [{ id: 1, paths: [], activePath: null }];
    expect(restored).toHaveLength(1);
  });
});
