import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DocumentManager } from "./documents";

beforeAll(() => {
  vi.stubGlobal("window", {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (timer) => clearTimeout(timer),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function makeFiles(initial) {
  const store = new Map(Object.entries(initial));

  return {
    store,
    readFile: vi.fn(async (path) => {
      if (!store.has(path)) {
        return { ok: false, status: "missing" };
      }
      const { content, lastModified } = store.get(path);
      return { ok: true, content, lastModified };
    }),
    writeFile: vi.fn(async (path, content) => {
      if (!store.has(path)) {
        return { ok: false, status: "missing" };
      }
      store.set(path, { content, lastModified: Date.now() });
      return { ok: true, lastModified: store.get(path).lastModified };
    }),
  };
}

describe("DocumentManager", () => {
  it("opens a document and marks it dirty on edits", async () => {
    const fs = makeFiles({ "a.js": { content: "one", lastModified: 1 } });
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    await manager.open("a.js", "a.js");

    const doc = manager.get("a.js");
    expect(doc.readStatus).toBe("ready");
    expect(doc.content).toBe("one");

    manager.update("a.js", "two");
    expect(manager.get("a.js").dirty).toBe(true);
  });

  it("detects conflicts when the file changed on disk", async () => {
    const fs = makeFiles({ "a.js": { content: "one", lastModified: 1 } });
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    await manager.open("a.js", "a.js");
    manager.update("a.js", "two");

    fs.store.set("a.js", { content: "one", lastModified: 99 });

    const result = await manager.save("a.js");
    expect(result.ok).toBe(false);
    expect(result.status).toBe("conflict");
    expect(result.diskContent).toBe("one");
  });

  it("saves without conflict when the disk content matches", async () => {
    const fs = makeFiles({ "a.js": { content: "one", lastModified: 1 } });
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    await manager.open("a.js", "a.js");
    manager.update("a.js", "two");

    const result = await manager.save("a.js");
    expect(result.ok).toBe(true);
    expect(manager.get("a.js").dirty).toBe(false);
    expect(manager.get("a.js").savedContent).toBe("two");
  });

  it("force-saves over a conflict", async () => {
    const fs = makeFiles({ "a.js": { content: "one", lastModified: 1 } });
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    await manager.open("a.js", "a.js");
    manager.update("a.js", "two");
    fs.store.set("a.js", { content: "one", lastModified: 99 });

    const result = await manager.save("a.js", { force: true });
    expect(result.ok).toBe(true);
    expect(fs.store.get("a.js").content).toBe("two");
  });

  it("reports missing files", async () => {
    const fs = makeFiles({});
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    const result = await manager.open("gone.js", "gone.js");
    expect(manager.get("gone.js").readStatus).toBe("error");
    expect(manager.get("gone.js").readError).toBe("missing");
    expect(result).toBeUndefined();
  });

  it("reloads content and clears dirty state", async () => {
    const fs = makeFiles({ "a.js": { content: "one", lastModified: 1 } });
    const manager = new DocumentManager({ readFile: fs.readFile, writeFile: fs.writeFile });

    await manager.open("a.js", "a.js");
    manager.update("a.js", "two");

    fs.store.set("a.js", { content: "three", lastModified: 2 });
    await manager.reload("a.js");

    const doc = manager.get("a.js");
    expect(doc.content).toBe("three");
    expect(doc.dirty).toBe(false);
  });
});