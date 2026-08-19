import { describe, expect, it } from "vitest";
import {
  collectFilePaths,
  normalizePath,
  resolveRelativeImport,
} from "./resolve";

const tree = {
  name: "proj",
  kind: "directory",
  path: "proj",
  children: [
    { name: "src", kind: "directory", path: "proj/src", children: [
      { name: "a.js", kind: "file", path: "proj/src/a.js" },
      { name: "sub", kind: "directory", path: "proj/src/sub", children: [
        { name: "index.ts", kind: "file", path: "proj/src/sub/index.ts" },
      ] },
    ] },
    { name: "readme.md", kind: "file", path: "proj/readme.md" },
  ],
};

describe("collectFilePaths", () => {
  it("collects all file paths", () => {
    const paths = collectFilePaths(tree);
    expect([...paths].sort()).toEqual([
      "proj/readme.md",
      "proj/src/a.js",
      "proj/src/sub/index.ts",
    ]);
  });

  it("handles null", () => {
    expect(collectFilePaths(null).size).toBe(0);
  });
});

describe("normalizePath", () => {
  it("normalizes dot segments", () => {
    expect(normalizePath("a/./b/../c")).toBe("a/c");
  });
});

describe("resolveRelativeImport", () => {
  const filePaths = collectFilePaths(tree);

  it("resolves exact paths", () => {
    expect(
      resolveRelativeImport("proj/src/a.js", "./sub/index", filePaths)
    ).toBe("proj/src/sub/index.ts");
  });

  it("resolves with extension inference", () => {
    expect(
      resolveRelativeImport("proj/src/a.js", "./a", filePaths)
    ).toBe("proj/src/a.js");
  });

  it("returns null for unresolved specifiers", () => {
    expect(
      resolveRelativeImport("proj/src/a.js", "./missing", filePaths)
    ).toBeNull();
    expect(
      resolveRelativeImport("proj/src/a.js", "lodash", filePaths)
    ).toBeNull();
  });
});