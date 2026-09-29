import { describe, it, expect } from "vitest";
import { detectFile } from "./detect";
import {
  formatSummary,
  formatDuration,
  clampText,
  splitLines,
  describeError,
  lastPythonFrame,
} from "./format";
import { buildPreviewDocument, previewSandboxPermissions } from "./html";
import { runFile, defaultTimeoutFor, RUN_TIMEOUTS } from "./index";

describe("detectFile", () => {
  it("marks plain JavaScript as runnable", () => {
    const result = detectFile("src/index.js", 'console.log("hello");');
    expect(result.runnable).toBe(true);
    expect(result.kind).toBe("javascript");
    expect(result.label).toBe("JavaScript");
  });

  it("marks Python as runnable", () => {
    const result = detectFile("scripts/main.py", "print('hi')");
    expect(result.runnable).toBe(true);
    expect(result.kind).toBe("python");
  });

  it("marks HTML as runnable", () => {
    const result = detectFile("public/index.html", "<!doctype html><html></html>");
    expect(result.runnable).toBe(true);
    expect(result.kind).toBe("html");
  });

  it("refuses JSX that actually contains JSX syntax", () => {
    const result = detectFile(
      "src/App.jsx",
      "export default function App() { return <div>App</div>; }"
    );
    expect(result.runnable).toBe(false);
    expect(result.kind).toBe("javascript-jsx");
    expect(result.reason).toMatch(/build step/i);
  });

  it("allows a .jsx file that contains no JSX syntax", () => {
    const result = detectFile("src/helpers.jsx", "export const add = (a, b) => a + b;");
    expect(result.runnable).toBe(true);
    expect(result.kind).toBe("javascript");
  });

  it("refuses TypeScript with an explanation", () => {
    const result = detectFile("src/main.ts", "const x: number = 1;");
    expect(result.runnable).toBe(false);
    expect(result.reason).toMatch(/compiler/i);
  });

  it("refuses CSS, JSON and Markdown", () => {
    expect(detectFile("styles.css", "body{}").runnable).toBe(false);
    expect(detectFile("data.json", "{}").runnable).toBe(false);
    expect(detectFile("README.md", "# hi").runnable).toBe(false);
  });

  it("falls back to a Python shebang when the extension is unknown", () => {
    const result = detectFile("bin/entry", "#!/usr/bin/env python3\nprint(1)");
    expect(result.runnable).toBe(true);
    expect(result.kind).toBe("python");
  });

  it("sniffs HTML when there is no extension", () => {
    const result = detectFile("template", "<!doctype html><html><body></body></html>");
    expect(result.kind).toBe("html");
  });

  it("returns a reason for unknown file types", () => {
    const result = detectFile("blob.qqq", "");
    expect(result.runnable).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("always exposes a sandbox hint for runnable languages", () => {
    for (const path of ["a.js", "a.py", "a.html"]) {
      expect(detectFile(path, "").hint).toMatch(/sandbox/i);
    }
  });
});

describe("format helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(12)).toBe("12ms");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(Number.NaN)).toBe("0ms");
    expect(formatDuration(-5)).toBe("0ms");
  });

  it("summarises a clean exit", () => {
    expect(formatSummary({ label: "a.js · JavaScript", exitCode: 0, durationMs: 12 })).toBe(
      "a.js · JavaScript · exited 0 · 12ms"
    );
  });

  it("summarises a failing exit", () => {
    expect(formatSummary({ label: "a.js", exitCode: 3, durationMs: 1 })).toBe(
      "a.js · exited 3 · 1ms"
    );
  });

  it("summarises a blocked run", () => {
    expect(
      formatSummary({ label: "a.ts", exitCode: 1, durationMs: 0, reason: "not runnable" })
    ).toBe("a.ts · not runnable · 0ms");
  });

  it("truncates oversized output", () => {
    const { text, truncated } = clampText("x".repeat(50), 10);
    expect(truncated).toBe(true);
    expect(text).toContain("more characters truncated");
    expect(clampText("small", 10).truncated).toBe(false);
  });

  it("splits buffered output into lines", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("describes thrown values", () => {
    expect(describeError(new TypeError("boom"))).toBe("TypeError: boom");
    expect(describeError("plain")).toBe("plain");
    expect(describeError(null)).toBe("Unknown error.");
  });

  it("picks the deepest Python frame", () => {
    const trace =
      'Traceback (most recent call last):\n  File "main.py", line 2, in <module>\n    boom\nNameError: name "boom" is not defined';
    expect(lastPythonFrame(trace)).toContain("main.py");
  });
});

describe("preview documents", () => {
  it("adds a charset when the snippet has no doctype", () => {
    const doc = buildPreviewDocument("<h1>hi</h1>");
    expect(doc).toContain("<meta charset=");
    expect(doc).toContain("<h1>hi</h1>");
  });

  it("keeps an existing doctype intact", () => {
    const source = "<!doctype html><html><body>ok</body></html>";
    const doc = buildPreviewDocument(source);
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc.match(/<!doctype/gi)).toHaveLength(1);
  });

  it("never grants same-origin access to the preview frame", () => {
    const permissions = previewSandboxPermissions();
    expect(permissions).toContain("allow-scripts");
    expect(permissions).not.toContain("allow-same-origin");
  });
});

describe("runFile", () => {
  it("explains why a non-runnable file was not executed", async () => {
    const result = await runFile({ path: "main.ts", code: "const x = 1;" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/compiler/i);
    expect(result.language.runnable).toBe(false);
  });

  it("returns a preview for HTML files without executing anything", async () => {
    const result = await runFile({ path: "index.html", code: "<h1>hi</h1>" });
    expect(result.exitCode).toBe(0);
    expect(result.preview).toContain("<h1>hi</h1>");
    expect(result.previewSandbox).not.toContain("allow-same-origin");
  });

  it("fails gracefully when no browser document exists", async () => {
    const result = await runFile({ path: "a.js", code: "console.log(1)" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/browser/i);
  });

  it("fails gracefully when Web Workers are unavailable", async () => {
    const result = await runFile({ path: "a.py", code: "print(1)" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Web Workers/i);
  });

  it("exposes sensible per-language timeouts", () => {
    expect(RUN_TIMEOUTS.javascript).toBeGreaterThan(0);
    expect(RUN_TIMEOUTS.python).toBeGreaterThan(RUN_TIMEOUTS.javascript);
    expect(defaultTimeoutFor("python")).toBe(RUN_TIMEOUTS.python);
    expect(defaultTimeoutFor("unknown")).toBe(5000);
  });
});
