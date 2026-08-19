import { describe, expect, it } from "vitest";
import {
  analyzeSource,
  isSupportedPath,
  languageForPath,
} from "./analyzer";

describe("isSupportedPath", () => {
  it("accepts JS/TS family extensions", () => {
    for (const p of [
      "a.js",
      "b.jsx",
      "c.ts",
      "d.tsx",
      "e.mjs",
      "f.cjs",
    ]) {
      expect(isSupportedPath(p)).toBe(true);
    }
  });

  it("rejects other files", () => {
    for (const p of ["a.css", "b.json", "c.md", "d.py"]) {
      expect(isSupportedPath(p)).toBe(false);
    }
  });
});

describe("languageForPath", () => {
  it("maps extensions to Monaco languages", () => {
    expect(languageForPath("x.js")).toBe("javascript");
    expect(languageForPath("x.jsx")).toBe("javascriptreact");
    expect(languageForPath("x.ts")).toBe("typescript");
    expect(languageForPath("x.tsx")).toBe("typescriptreact");
    expect(languageForPath("x.mjs")).toBe("javascript");
  });
});

describe("analyzeSource", () => {
  it("parses imports, exports and symbols", () => {
    const content = [
      'import fs from "fs";',
      'import { a, b as c } from "./util";',
      "import * as ns from './namespace';",
      "",
      "export const PI = 3.14;",
      "export function helper() {}",
      "const unused = 1;",
      "function local() {}",
    ].join("\n");

    const result = analyzeSource(content, {
      path: "src/x.js",
      language: languageForPath("src/x.js"),
    });

    expect(result.path).toBe("src/x.js");
    expect(result.language).toBe("javascript");
    expect(result.imports).toHaveLength(3);
    expect(result.imports[0]).toMatchObject({
      source: "fs",
      names: ["fs"],
      line: 1,
    });
    expect(result.imports[1]).toMatchObject({
      source: "./util",
      names: ["a", "c"],
    });
    expect(result.imports[2]).toMatchObject({
      source: "./namespace",
      names: ["ns"],
    });

    expect(result.exports.map((e) => e.name)).toEqual(["PI", "helper"]);
    expect(result.symbols.map((s) => s.name).sort()).toEqual([
      "PI",
      "helper",
      "local",
      "unused",
    ]);
  });

  it("ignores strings, comments and template content", () => {
    const content = [
      "const url = 'import { x } from \"fake\"';",
      "// import { y } from './commented';",
      "/* export const z = 1; */",
      "const template = `const q = 1;`;",
      "const real = 5;",
    ].join("\n");

    const result = analyzeSource(content);

    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
    expect(result.symbols.map((s) => s.name).sort()).toEqual([
      "real",
      "template",
      "url",
    ]);
  });

  it("handles default export functions and classes", () => {
    const result = analyzeSource(
      "export default function Foo() {}\nexport default class Bar {}"
    );

    expect(result.exports.map((e) => [e.name, e.kind])).toEqual([
      ["Foo", "function"],
      ["Bar", "class"],
    ]);
  });

  it("returns an empty result for empty content", () => {
    const result = analyzeSource("");
    expect(result.supported).toBe(true);
    expect(result.imports).toEqual([]);
    expect(result.symbols).toEqual([]);
  });
});