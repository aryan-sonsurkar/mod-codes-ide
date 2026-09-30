import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const diskMock = {
  isDirectoryAccessSupported: vi.fn(() => true),
  openProjectDirectory: vi.fn(async () => ({ ok: true, tree: { kind: "directory", name: "disk" } })),
  readFile: vi.fn(async () => ({ ok: true, content: "disk" })),
  writeFile: vi.fn(async () => ({ ok: true })),
  createFile: vi.fn(async () => ({ ok: true, path: "disk/file" })),
  createDirectory: vi.fn(async () => ({ ok: true, path: "disk/dir" })),
  renameEntry: vi.fn(async () => ({ ok: true, path: "disk/renamed" })),
  deleteEntry: vi.fn(async () => ({ ok: true })),
  rescanProjectTree: vi.fn(async () => ({ ok: true, tree: { kind: "directory", name: "disk" } })),
  searchWorkspace: vi.fn(async () => ({ ok: true, matches: [] })),
  previewWorkspaceReplace: vi.fn(async () => ({ ok: true, files: [], totalMatches: 0, totalFiles: 0 })),
  getRootHandle: vi.fn(() => null),
};

vi.mock("./filesystem", () => diskMock);

async function loadFacade() {
  vi.resetModules();
  return import("./index");
}

describe("filesystem facade", () => {
  beforeEach(() => {
    for (const fn of Object.values(diskMock)) {
      if (vi.isMockFunction(fn)) fn.mockClear();
    }
    diskMock.isDirectoryAccessSupported.mockReturnValue(true);
  });

  afterEach(async () => {
    const facade = await loadFacade();
    facade.closeWorkspace();
  });

  it("opens a virtual project without touching the File System Access API", async () => {
    const facade = await loadFacade();

    const result = await facade.openProjectDirectory({
      name: "demo",
      storage: "virtual",
      location: "This browser",
    });

    expect(result.ok).toBe(true);
    expect(diskMock.openProjectDirectory).not.toHaveBeenCalled();
    expect(facade.isWorkspaceVirtual()).toBe(true);

    const read = await facade.readFile("demo/README.md");
    expect(read.ok).toBe(true);
    expect(diskMock.readFile).not.toHaveBeenCalled();
  });

  it("routes disk projects to the File System Access API", async () => {
    const facade = await loadFacade();

    const result = await facade.openProjectDirectory({
      name: "demo",
      storage: "disk",
      location: "some-folder",
    });

    expect(result.ok).toBe(true);
    expect(diskMock.openProjectDirectory).toHaveBeenCalled();
    expect(facade.isWorkspaceVirtual()).toBe(false);

    await facade.readFile("demo/README.md");
    expect(diskMock.readFile).toHaveBeenCalledWith("demo/README.md");
  });

  it("reports unsupported when the browser has no folder API", async () => {
    diskMock.isDirectoryAccessSupported.mockReturnValue(false);
    const facade = await loadFacade();

    const result = await facade.openProjectDirectory({ name: "demo", storage: "disk" });

    expect(result).toEqual({ ok: false, status: "unsupported" });
  });
});
