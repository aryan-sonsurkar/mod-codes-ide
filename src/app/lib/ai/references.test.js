import { describe, expect, it } from "vitest";
import { createReference, parseReferencesFromText, referencesFromDiagnostics } from "./references";

describe("references", () => {
  it("creates a reference with label", () => {
    const ref = createReference({ type: "file", path: "src/a.js", line: 10 });
    expect(ref.label).toBe("src/a.js:10");
  });

  it("parses references from text", () => {
    const refs = parseReferencesFromText("See src/foo.js:42 and src/bar.ts:10:5");
    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs[0].path).toBe("src/foo.js");
    expect(refs[0].line).toBe(42);
  });

  it("maps diagnostics to references", () => {
    const refs = referencesFromDiagnostics([{ path: "src/a.js", line: 5, message: "err" }]);
    expect(refs[0].type).toBe("diagnostic");
  });
});
