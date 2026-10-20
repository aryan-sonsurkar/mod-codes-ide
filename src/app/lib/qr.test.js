import { describe, expect, it } from "vitest";
import { buildQrMatrix, pickPreferredLanUrl, qrSvgPath } from "./qr";

describe("buildQrMatrix", () => {
  it("produces a square matrix of dark/light modules", () => {
    const matrix = buildQrMatrix("http://macbook.local:11434");
    expect(matrix.length).toBeGreaterThan(20);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    expect(matrix.join("")).toMatch(/^[01]+$/);
    expect(matrix.join("")).toContain("1");
  });

  it("is deterministic and changes with the payload", () => {
    const a = buildQrMatrix("http://192.168.1.20:11434");
    const b = buildQrMatrix("http://192.168.1.20:11434");
    const c = buildQrMatrix("http://192.168.1.21:11434");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("supports the error-correction levels the wizard uses", () => {
    for (const level of ["L", "M", "Q", "H"]) {
      const matrix = buildQrMatrix("http://phone.local:11434", {
        errorCorrection: level,
      });
      expect(matrix.length).toBeGreaterThan(20);
    }
  });

  it("rejects empty and oversized payloads", () => {
    expect(() => buildQrMatrix("")).toThrow(/empty/i);
    expect(() => buildQrMatrix("   ")).toThrow(/empty/i);
    expect(() => buildQrMatrix("x".repeat(1201))).toThrow(/too long/i);
    expect(() => buildQrMatrix(null)).toThrow(/empty/i);
  });
});

describe("qrSvgPath", () => {
  it("merges horizontal runs and offsets by the quiet zone", () => {
    const matrix = ["110", "000", "001"];
    const { size, path } = qrSvgPath(matrix, { margin: 2 });
    expect(size).toBe(7);
    expect(path).toBe("M2 2h2v1h-2zM4 4h1v1h-1z");
  });

  it("handles a matrix whose first module is dark at the margin edge", () => {
    const { path } = qrSvgPath(["100", "100"], { margin: 0 });
    expect(path).toBe("M0 0h1v1h-1zM0 1h1v1h-1z");
  });

  it("rejects an empty matrix", () => {
    expect(() => qrSvgPath([])).toThrow(/empty/i);
    expect(() => qrSvgPath(null)).toThrow(/empty/i);
  });
});

describe("pickPreferredLanUrl", () => {
  it("prefers mDNS names over raw IPs", () => {
    const urls = [
      { address: "192.168.1.20", kind: "ipv4", url: "http://192.168.1.20:11434" },
      { address: "a1b2.local", kind: "mdns", url: "http://a1b2.local:11434" },
    ];
    expect(pickPreferredLanUrl(urls)).toBe(urls[1]);
    expect(pickPreferredLanUrl([urls[0]])).toBe(urls[0]);
    expect(pickPreferredLanUrl([])).toBeNull();
    expect(pickPreferredLanUrl(null)).toBeNull();
  });
});
