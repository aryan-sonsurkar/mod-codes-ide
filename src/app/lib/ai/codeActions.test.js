import { describe, expect, it } from "vitest";
import { buildCodeActionPrompt, getCodeAction, isSelectionRequired } from "./codeActions";

describe("codeActions", () => {
  it("builds explain selection prompt", () => {
    const prompt = buildCodeActionPrompt("ai.explain-selection", {
      selection: "const x = 1;",
      path: "src/a.js",
    });
    expect(prompt).toContain("const x = 1;");
    expect(prompt).toContain("src/a.js");
  });

  it("returns null for ask action", () => {
    expect(buildCodeActionPrompt("ai.ask", {})).toBeNull();
  });

  it("identifies selection requirement", () => {
    expect(isSelectionRequired("ai.explain-selection")).toBe(true);
    expect(isSelectionRequired("ai.explain-file")).toBe(false);
  });

  it("returns null for unknown action", () => {
    expect(getCodeAction("unknown")).toBeNull();
  });
});
