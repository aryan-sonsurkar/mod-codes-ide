const LANGUAGE_BY_EXT = {
  js: { id: "javascript", label: "JavaScript", kind: "javascript" },
  mjs: { id: "javascript", label: "JavaScript", kind: "javascript" },
  cjs: { id: "javascript", label: "JavaScript (CommonJS)", kind: "javascript" },
  jsx: { id: "javascript", label: "JavaScript (JSX)", kind: "javascript-jsx" },
  ts: { id: "typescript", label: "TypeScript", kind: "unsupported" },
  mts: { id: "typescript", label: "TypeScript", kind: "unsupported" },
  cts: { id: "typescript", label: "TypeScript", kind: "unsupported" },
  tsx: { id: "typescript", label: "TypeScript (TSX)", kind: "unsupported" },
  py: { id: "python", label: "Python", kind: "python" },
  pyw: { id: "python", label: "Python", kind: "python" },
  html: { id: "html", label: "HTML", kind: "html" },
  htm: { id: "html", label: "HTML", kind: "html" },
  css: { id: "css", label: "CSS", kind: "unsupported" },
  scss: { id: "css", label: "SCSS", kind: "unsupported" },
  json: { id: "json", label: "JSON", kind: "unsupported" },
  md: { id: "markdown", label: "Markdown", kind: "unsupported" },
  yml: { id: "yaml", label: "YAML", kind: "unsupported" },
  yaml: { id: "yaml", label: "YAML", kind: "unsupported" },
  sh: { id: "shell", label: "Shell", kind: "unsupported" },
  bash: { id: "shell", label: "Shell", kind: "unsupported" },
  c: { id: "c", label: "C", kind: "unsupported" },
  cpp: { id: "cpp", label: "C++", kind: "unsupported" },
  java: { id: "java", label: "Java", kind: "unsupported" },
  rs: { id: "rust", label: "Rust", kind: "unsupported" },
  go: { id: "go", label: "Go", kind: "unsupported" },
  rb: { id: "ruby", label: "Ruby", kind: "unsupported" },
  php: { id: "php", label: "PHP", kind: "unsupported" },
  sql: { id: "sql", label: "SQL", kind: "unsupported" },
  txt: { id: "text", label: "Plain text", kind: "unsupported" },
};

const UNSUPPORTED_REASONS = {
  typescript: "TypeScript needs a compiler step, so it cannot run directly in the browser. Strip the types or keep it in the editor and ask the AI to transpile it.",
  jsx: "This file contains JSX, which needs a build step. Move the JSX into an HTML preview or run the plain JavaScript entry point instead.",
  css: "Stylesheets do not produce output on their own. Open an HTML file to preview them.",
  json: "JSON is data, not a program, so there is nothing to run.",
  markdown: "Markdown renders as documentation, not executable code.",
  yaml: "YAML is configuration, not a program, so there is nothing to run.",
  shell: "Shell scripts would need a real operating system shell. The in-browser terminal is intentionally sandboxed.",
  c: "Native compilers are not available in the browser sandbox.",
  cpp: "Native compilers are not available in the browser sandbox.",
  java: "A JVM is not available in the browser sandbox.",
  rust: "A Rust toolchain is not available in the browser sandbox.",
  go: "A Go toolchain is not available in the browser sandbox.",
  ruby: "A Ruby interpreter is not available in the browser sandbox.",
  php: "A PHP interpreter is not available in the browser sandbox.",
  sql: "SQL needs a database engine, which is not bundled with the editor.",
  text: "Plain text has no runnable syntax.",
  unknown: "This file type has no in-browser runtime yet.",
};

const DEFAULT_REASON =
  "There is no in-browser runtime registered for this file type yet.";

function extensionOf(path) {
  if (typeof path !== "string") {
    return "";
  }
  const clean = path.split(/[?#]/)[0];
  const segments = clean.split("/");
  const name = segments[segments.length - 1] || "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return name.slice(dot + 1).toLowerCase();
}

function sniffJavaScriptSyntax(code) {
  if (typeof code !== "string") {
    return false;
  }
  return /<[A-Za-z][\w.-]*(\s|>|\/)/.test(code) || /\binterface\s+[A-Za-z_$][\w$]*\s*\{/.test(code);
}

export function detectFile(path, code) {
  const ext = extensionOf(path);
  const entry = LANGUAGE_BY_EXT[ext];

  if (entry) {
    if (entry.kind === "javascript-jsx") {
      if (sniffJavaScriptSyntax(code)) {
        return unsupported("jsx", entry.label, "javascript-jsx", "jsx");
      }
      return runnable("javascript", entry.label, "javascript");
    }
    if (entry.kind === "unsupported") {
      return unsupported(entry.id, entry.label, entry.kind, entry.id);
    }
    return runnable(entry.id, entry.label, entry.kind);
  }

  if (/^#!.*\bpython3?\b/.test(code || "")) {
    return runnable("python", "Python", "python");
  }
  if (/^\s*<!doctype\s+html/i.test(code || "") || /<html[\s>]/i.test(code || "")) {
    return runnable("html", "HTML", "html");
  }
  if (/^\s*(export|import|const|let|var|function|class)\s/.test((code || "").trim())) {
    return runnable("javascript", "JavaScript", "javascript");
  }

  return unsupported("unknown", ext ? ext.toUpperCase() : "Unknown", "unknown");
}

function runnable(id, label, kind) {
  return {
    runnable: true,
    id,
    label,
    kind,
    reason: null,
    hint: hintFor(id),
  };
}

function unsupported(id, label, kind, reasonKey = kind) {
  return {
    runnable: false,
    id,
    label,
    kind,
    reason: UNSUPPORTED_REASONS[reasonKey] || DEFAULT_REASON,
    hint: null,
  };
}

function hintFor(id) {
  if (id === "python") {
    return "Runs in a sandboxed Pyodide worker. The runtime is downloaded once and then works offline.";
  }
  if (id === "html") {
    return "Renders in a sandboxed preview frame with no access to this page.";
  }
  return "Runs in a sandboxed iframe with no access to this page, your files, or your account.";
}

export function detectLanguage(path, code) {
  return detectFile(path, code);
}
