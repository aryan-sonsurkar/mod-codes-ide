import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeVirtualWorkspace,
  isWorkspaceVirtual,
  openVirtualWorkspace,
  virtualCreateDirectory,
  virtualCreateFile,
  virtualDeleteEntry,
  virtualPreviewWorkspaceReplace,
  virtualReadFile,
  virtualRenameEntry,
  virtualRescanProjectTree,
  virtualSearchWorkspace,
  virtualWriteFile,
} from "./virtualFS";

function readTreePaths(node, out = []) {
  if (!node) return out;
  out.push(node.path);
  for (const child of node.children || []) {
    readTreePaths(child, out);
  }
  return out;
}

describe("virtual workspace", () => {
  beforeEach(() => {
    closeVirtualWorkspace();
  });

  afterEach(() => {
    closeVirtualWorkspace();
    vi.unstubAllGlobals();
  });

  it("opens a seeded project tree", () => {
    const result = openVirtualWorkspace("demo");

    expect(result.ok).toBe(true);
    expect(result.tree.kind).toBe("directory");
    expect(result.tree.name).toBe("demo");

    const paths = readTreePaths(result.tree);
    expect(paths).toContain("demo/README.md");
    expect(paths).toContain("demo/src/index.js");
    expect(isWorkspaceVirtual()).toBe(true);
  });

  it("reads and writes files", () => {
    openVirtualWorkspace("demo");

    const read = virtualReadFile("demo/src/index.js");
    expect(read.ok).toBe(true);
    expect(read.content).toContain("console.log");

    const write = virtualWriteFile("demo/src/index.js", "print('hi')");
    expect(write.ok).toBe(true);

    const reread = virtualReadFile("demo/src/index.js");
    expect(reread.content).toBe("print('hi')");
  });

  it("creates files and directories then renames and deletes them", () => {
    openVirtualWorkspace("demo");

    const folder = virtualCreateDirectory("demo", "lib");
    expect(folder.ok).toBe(true);
    expect(folder.path).toBe("demo/lib");

    const file = virtualCreateFile("demo/lib", "helper.js");
    expect(file.ok).toBe(true);

    virtualWriteFile("demo/lib/helper.js", "export const n = 1;");
    expect(virtualReadFile("demo/lib/helper.js").content).toBe("export const n = 1;");

    const rename = virtualRenameEntry("demo/lib/helper.js", "math.js");
    expect(rename.ok).toBe(true);
    expect(virtualReadFile("demo/lib/math.js").ok).toBe(true);
    expect(virtualReadFile("demo/lib/helper.js").status).toBe("missing");

    const folderRename = virtualRenameEntry("demo/lib", "utils");
    expect(folderRename.ok).toBe(true);
    expect(virtualReadFile("demo/utils/math.js").ok).toBe(true);

    const tree = virtualRescanProjectTree();
    expect(readTreePaths(tree.tree)).toContain("demo/utils/math.js");

    expect(virtualDeleteEntry("demo/utils").ok).toBe(true);
    expect(virtualReadFile("demo/utils/math.js").status).toBe("missing");
  });

  it("reports missing files and invalid names", () => {
    openVirtualWorkspace("demo");

    expect(virtualReadFile("demo/nope.js").status).toBe("missing");
    expect(virtualCreateFile("demo", "../escape").status).toBe("invalid-name");
    expect(virtualCreateFile("missing-dir", "a.js").status).toBe("missing");
    expect(virtualWriteFile("missing-dir/a.js", "x").status).toBe("missing");
  });

  it("creates new files through writeFile when the parent exists", () => {
    openVirtualWorkspace("demo");

    const write = virtualWriteFile("demo/notes.md", "# notes");
    expect(write.ok).toBe(true);
    expect(virtualReadFile("demo/notes.md").content).toBe("# notes");
  });

  it("searches the workspace", () => {
    openVirtualWorkspace("demo");
    virtualWriteFile("demo/README.md", "hello browser\nhello again");

    const result = virtualSearchWorkspace("hello");
    expect(result.ok).toBe(true);

    const readmeMatches = result.matches.filter((m) => m.path === "demo/README.md");
    expect(readmeMatches.length).toBe(2);
    expect(readmeMatches[0].line).toBe(1);
    expect(result.matches.some((m) => m.path === "demo/src/index.js")).toBe(true);
  });

  it("previews replace-all matches", () => {
    openVirtualWorkspace("demo");
    virtualWriteFile("demo/README.md", "foo foo\nbar");

    const preview = virtualPreviewWorkspaceReplace("foo", {});
    expect(preview.totalMatches).toBe(2);
    expect(preview.totalFiles).toBe(1);
    expect(preview.files[0].path).toBe("demo/README.md");
  });

  it("persists the workspace across reopen", () => {
    const store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    });

    openVirtualWorkspace("demo");
    virtualWriteFile("demo/README.md", "kept");
    closeVirtualWorkspace();

    const reopened = openVirtualWorkspace("demo");
    expect(reopened.ok).toBe(true);
    expect(virtualReadFile("demo/README.md").content).toBe("kept");
    expect(store.has("modcodes-virtual-fs:demo")).toBe(true);
  });

  it("refuses to open without a project name", () => {
    expect(openVirtualWorkspace("   ").ok).toBe(false);
    expect(isWorkspaceVirtual()).toBe(false);
  });
});
