import { describe, expect, it } from "vitest";
import { createZip } from "./zip";
import {
  buildWorkspaceArchive,
  isSafeArchivePath,
  parseWorkspaceArchive,
} from "./workspaceArchive";

describe("isSafeArchivePath", () => {
  it("accepts plain relative paths", () => {
    expect(isSafeArchivePath("index.js")).toBe(true);
    expect(isSafeArchivePath("src/lib/util.js")).toBe(true);
  });

  it("rejects traversal, absolute, and drive-letter paths", () => {
    expect(isSafeArchivePath("../evil.js")).toBe(false);
    expect(isSafeArchivePath("src/../../etc/passwd")).toBe(false);
    expect(isSafeArchivePath("/etc/passwd")).toBe(false);
    expect(isSafeArchivePath("C:/Windows/system.ini")).toBe(false);
    expect(isSafeArchivePath("")).toBe(false);
    expect(isSafeArchivePath(null)).toBe(false);
  });
});

describe("buildWorkspaceArchive", () => {
  it("rejects empty file lists", () => {
    expect(buildWorkspaceArchive({ files: [] }).status).toBe("empty");
    expect(buildWorkspaceArchive({}).status).toBe("empty");
  });

  it("builds a filename from the project name", () => {
    const built = buildWorkspaceArchive({
      files: [{ path: "index.js", content: "x" }],
      projectName: "My Project!",
    });
    expect(built.ok).toBe(true);
    expect(built.filename).toMatch(/-workspace\.zip$/);
    expect(built.fileCount).toBe(1);
    expect(built.skipped).toBe(0);
  });

  it("skips unsafe paths and oversized content", () => {
    const built = buildWorkspaceArchive({
      files: [
        { path: "ok.js", content: "x" },
        { path: "../evil.js", content: "x" },
        { path: "big.js", content: "y".repeat(2 * 1024 * 1024 + 1) },
      ],
      projectName: "p",
    });
    expect(built.ok).toBe(true);
    expect(built.fileCount).toBe(1);
    expect(built.skipped).toBe(2);
  });
});

describe("parseWorkspaceArchive", () => {
  it("roundtrips files through build then parse", async () => {
    const built = buildWorkspaceArchive({
      files: [
        { path: "index.js", content: "console.log(1);" },
        { path: "src/app.js", content: "export const a = 1;" },
      ],
      projectName: "roundtrip",
    });
    const parsed = await parseWorkspaceArchive(built.bytes);
    expect(parsed.ok).toBe(true);
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].path).toBe("index.js");
    expect(parsed.files[1].content).toBe("export const a = 1;");
    expect(parsed.skipped).toBe(0);
  });

  it("filters zip-slip entries", async () => {
    const zip = createZip([
      { name: "safe.txt", content: "ok" },
      { name: "../escape.txt", content: "bad" },
    ]);
    const parsed = await parseWorkspaceArchive(zip.bytes);
    expect(parsed.ok).toBe(true);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toBe("safe.txt");
    expect(parsed.skipped).toBe(1);
  });

  it("rejects archives where every entry is unsafe", async () => {
    const zip = createZip([{ name: "../escape.txt", content: "bad" }]);
    const parsed = await parseWorkspaceArchive(zip.bytes);
    expect(parsed.ok).toBe(false);
    expect(parsed.status).toBe("no-safe-files");
  });

  it("propagates parse failures", async () => {
    const parsed = await parseWorkspaceArchive(new Uint8Array([9, 9, 9]));
    expect(parsed.ok).toBe(false);
  });
});
