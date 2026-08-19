import { describe, expect, it } from "vitest";
import { scanSyntax } from "./syntax";

describe("scanSyntax", () => {
  it("returns balanced depths for plain code", () => {
    const result = scanSyntax("const x = { a: 1 };\nfn(1);");
    expect(result.lineCount).toBe(2);
    expect(result.braceDepths[0]).toBe(0);
    expect(result.braceDepths[1]).toBe(0);
    expect(result.openRemainders).toEqual([]);
    expect(result.unexpectedClosers).toEqual([]);
  });

  it("tracks per-line depth", () => {
    const result = scanSyntax("{\n  inner\n}\n");
    expect(result.braceDepths[0]).toBe(1);
    expect(result.braceDepths[1]).toBe(1);
    expect(result.braceDepths[2]).toBe(0);
  });

  it("ignores braces inside strings and comments", () => {
    const result = scanSyntax(
      'const s = "{ not a brace"; // } also not\n/* { } */'
    );
    expect(result.braceDepths[0]).toBe(0);
    expect(result.openRemainders).toEqual([]);
  });

  it("records unexpected closers", () => {
    const result = scanSyntax("} extra");
    expect(result.unexpectedClosers).toHaveLength(1);
    expect(result.unexpectedClosers[0]).toMatchObject({
      line: 1,
      column: 1,
    });
  });

  it("records remaining open delimiters", () => {
    const result = scanSyntax("if (x) {");
    expect(result.openRemainders.some((r) => r.open === "{")).toBe(true);
    expect(result.openRemainders[0]).toMatchObject({ open: "{", count: 1 });
    expect(result.braceDepths[0]).toBe(1);
  });

  it("treats regex literals as code, not division by default", () => {
    const result = scanSyntax("const re = /[{}]/g;\nconst x = a / b;");
    expect(result.openRemainders).toEqual([]);
  });
});