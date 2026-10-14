import { describe, expect, it } from "vitest";
import { createZip, crc32, parseZip, zipEntryToText } from "./zip";

const textEncoder = new TextEncoder();

describe("crc32", () => {
  it("matches a known checksum", () => {
    expect(crc32(textEncoder.encode("123456789"))).toBe(0xcbf43926);
  });

  it("matches the empty checksum", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("createZip", () => {
  it("rejects empty entry lists", () => {
    expect(createZip([]).ok).toBe(false);
    expect(createZip([]).status).toBe("empty");
  });

  it("builds a zip whose local header signature starts the file", () => {
    const result = createZip([{ name: "a.txt", content: "hello" }]);
    expect(result.ok).toBe(true);
    expect(result.bytes[0]).toBe(0x50);
    expect(result.bytes[1]).toBe(0x4b);
    expect(result.bytes[2]).toBe(0x03);
    expect(result.bytes[3]).toBe(0x04);
  });

  it("normalizes backslashes and leading slashes in names", async () => {
    const result = createZip([{ name: "/src\\a.txt", content: "x" }]);
    expect(result.ok).toBe(true);
    const parsed = await parseZip(result.bytes);
    expect(parsed.ok).toBe(true);
    expect(parsed.entries[0].name).toBe("src/a.txt");
  });

  it("skips directory-like entries", async () => {
    const result = createZip([
      { name: "dir/", content: "" },
      { name: "a.txt", content: "x" },
    ]);
    expect(result.ok).toBe(true);
    const parsed = await parseZip(result.bytes);
    expect(parsed.entries).toHaveLength(1);
  });
});

describe("parseZip roundtrip", () => {
  it("roundtrips a single text file", async () => {
    const created = createZip([{ name: "index.js", content: "console.log('hi');" }]);
    const parsed = await parseZip(created.bytes);
    expect(parsed.ok).toBe(true);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].name).toBe("index.js");
    expect(zipEntryToText(parsed.entries[0])).toBe("console.log('hi');");
  });

  it("roundtrips nested paths and unicode content", async () => {
    const created = createZip([
      { name: "src/lib/util.js", content: "export const x = 1;\n" },
      { name: "README.md", content: "# Ünïcode ✓\n" },
    ]);
    const parsed = await parseZip(created.bytes);
    expect(parsed.ok).toBe(true);
    expect(parsed.entries.map((e) => e.name).sort()).toEqual(["README.md", "src/lib/util.js"]);
    const readme = parsed.entries.find((e) => e.name === "README.md");
    expect(zipEntryToText(readme)).toContain("Ünïcode");
  });

  it("roundtrips an empty file", async () => {
    const created = createZip([
      { name: "empty.txt", content: "" },
      { name: "full.txt", content: "data" },
    ]);
    const parsed = await parseZip(created.bytes);
    expect(parsed.ok).toBe(true);
    const empty = parsed.entries.find((e) => e.name === "empty.txt");
    expect(empty.content).toHaveLength(0);
  });

  it("roundtrips binary content", async () => {
    const binary = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const created = createZip([{ name: "blob.bin", content: binary }]);
    const parsed = await parseZip(created.bytes);
    expect(parsed.ok).toBe(true);
    expect(Array.from(parsed.entries[0].content)).toEqual(Array.from(binary));
  });

  it("rejects non-zip buffers", async () => {
    const parsed = await parseZip(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(parsed.ok).toBe(false);
    expect(parsed.status).toBe("not-zip");
  });
});
