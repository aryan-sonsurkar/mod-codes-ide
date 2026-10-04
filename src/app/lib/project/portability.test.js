import { describe, expect, it } from "vitest";
import { createEmptyModcodes, serializeModcodes } from "./modcodes";
import {
  buildModcodesExport,
  downloadModcodesExport,
  importModcodesFile,
  importModcodesText,
  applyImportedModcodes,
} from "./portability";

describe(".modcodes portability", () => {
  it("builds an export that round-trips through import", () => {
    const data = createEmptyModcodes({ name: "My Demo App", phase: "prd" });
    const built = buildModcodesExport({ data });

    expect(built.ok).toBe(true);
    expect(built.filename).toBe("My-Demo-App.modcodes");

    const imported = importModcodesText(built.content);
    expect(imported.ok).toBe(true);
    expect(imported.data.project.name).toBe("My Demo App");
    expect(imported.data.project.phase).toBe("prd");

    const normalize = (text) => text.replace(/updatedAt: [^\n]+/, "updatedAt: <stamp>");
    expect(normalize(serializeModcodes(imported.data))).toBe(normalize(built.content));
  });

  it("sanitizes the project name into a safe filename", () => {
    const data = createEmptyModcodes({ name: "My Demo App" });

    expect(buildModcodesExport({ data, projectName: "  a/b\\c *name*  " }).filename).toBe(
      "a-b-c-name.modcodes"
    );
    expect(buildModcodesExport({ data, projectName: "   " }).filename).toBe(
      "project.modcodes"
    );
  });

  it("refuses to build an export without data", () => {
    expect(buildModcodesExport({}).ok).toBe(false);
    expect(buildModcodesExport({ data: null }).status).toBe("missing-data");
  });

  it("rejects empty input and files that are not project memory", () => {
    expect(importModcodesText("").status).toBe("empty");
    expect(importModcodesText("   ").status).toBe("empty");
    expect(importModcodesText("just some random text").status).toBe("not-modcodes");
  });

  it("imports memory from a File-like object", async () => {
    const data = createEmptyModcodes({ name: "From File" });
    const file = {
      text: async () => serializeModcodes(data),
    };

    const imported = await importModcodesFile(file);
    expect(imported.ok).toBe(true);
    expect(imported.data.project.name).toBe("From File");
  });

  it("reports a missing or unreadable file", async () => {
    expect((await importModcodesFile(null)).status).toBe("missing-file");
    expect(
      (await importModcodesFile({ text: async () => { throw new Error("boom"); } })).status
    ).toBe("read-error");
  });

  it("degrades gracefully outside a browser", () => {
    const data = createEmptyModcodes({ name: "No DOM" });
    const result = downloadModcodesExport({ data });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unsupported");
    expect(result.content).toContain("No DOM");
  });

  it("does not apply imported memory without an open workspace", async () => {
    expect((await applyImportedModcodes({})).status).toBe("missing-root");
    expect(
      (await applyImportedModcodes({ rootName: "demo" })).ok
    ).toBe(false);
  });
});
