import { describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceReplaceCore,
  readDocumentContent,
  replaceSingleMatch,
} from "./searchReplace";

const files = [
  { path: "a.js", name: "a.js" },
  { path: "b.js", name: "b.js" },
];

describe("readDocumentContent", () => {
  it("prefers the open tab content", async () => {
    const result = await readDocumentContent({
      tab: { content: "tab", savedContent: "disk" },
      read: vi.fn(),
      path: "a.js",
    });
    expect(result).toEqual({ content: "tab", savedContent: "disk" });
  });

  it("falls back to disk", async () => {
    const read = vi.fn(async () => ({
      ok: true,
      content: "disk-content",
    }));
    const result = await readDocumentContent({ tab: null, read, path: "a.js" });
    expect(result.content).toBe("disk-content");
  });

  it("returns null when read fails", async () => {
    const read = vi.fn(async () => ({ ok: false }));
    const result = await readDocumentContent({ tab: null, read, path: "a.js" });
    expect(result).toBeNull();
  });
});

describe("replaceSingleMatch", () => {
  it("replaces a single occurrence", async () => {
    const setContent = vi.fn();
    const result = await replaceSingleMatch({
      getDocument: () => ({ path: "a.js", content: "a b a", savedContent: "a b a" }),
      read: vi.fn(),
      setContent,
      match: { path: "a.js", name: "a.js", line: 1, column: 1, length: 1 },
      replacement: "X",
    });

    expect(result).toBe(true);
    expect(setContent).toHaveBeenCalledWith("a.js", "a.js", "X b a", "a b a");
  });
});

describe("applyWorkspaceReplaceCore", () => {
  it("replaces across files and reports the count", async () => {
    const setContent = vi.fn();
    const applied = await applyWorkspaceReplaceCore({
      files,
      getDocument: () => null,
      read: async (path) => ({
        ok: true,
        content: path === "a.js" ? "foo bar foo" : "no match",
      }),
      setContent,
      query: "foo",
      replacement: "FOO",
      options: {},
    });

    expect(applied).toBe(1);
    expect(setContent).toHaveBeenCalledWith("a.js", "a.js", "FOO bar FOO", "foo bar foo");
  });
});