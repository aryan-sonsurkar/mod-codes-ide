import { describe, it, expect } from "vitest";
import {
  parseModcodes,
  serializeModcodes,
  createEmptyModcodes,
  getSection,
  setSection,
  PROJECT_PHASES,
} from "./modcodes";

describe("modcodes project memory", () => {
  it("creates empty with defaults", () => {
    const d = createEmptyModcodes({ name: "  Test  ", phase: "research" });
    expect(d.project.name).toBe("Test");
    expect(d.project.phase).toBe("research");
    expect(d.modcodesVersion).toBe(1);
  });

  it("falls back invalid phase to idea", () => {
    const d = createEmptyModcodes({ name: "x", phase: "invalid" });
    expect(d.project.phase).toBe("idea");
  });

  it("parse/serialize roundtrip preserves frontmatter and sections", () => {
    const data = createEmptyModcodes({ name: "My App", phase: "prd" });
    data.sections["Problem"] = "Users need X";
    data.sections["PRD"] = "## Goals\nDo thing";
    const raw = serializeModcodes(data);
    const parsed = parseModcodes(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.project.name).toBe("My App");
    expect(parsed.data.project.phase).toBe("prd");
    expect(parsed.data.sections["Problem"]).toBe("Users need X");
  });

  it("handles missing frontmatter", () => {
    const parsed = parseModcodes("# Project\nHello");
    expect(parsed.ok).toBe(true);
    expect(parsed.data.sections["Project"]).toBe("Hello");
    expect(parsed.warnings).toContain("missing-frontmatter");
  });

  it("getSection/setSection by alias case-insensitive", () => {
    const d = createEmptyModcodes({ name: "A" });
    const next = setSection(d, "open questions", "Q1?");
    expect(getSection(next, "Open Questions")).toBe("Q1?");
  });

  it("serialize includes all canonical sections", () => {
    const raw = serializeModcodes(createEmptyModcodes({ name: "B" }));
    for (const p of PROJECT_PHASES) expect(raw).toContain("---");
    expect(raw).toContain("# Project");
    expect(raw).toContain("# Agent History");
  });
});
