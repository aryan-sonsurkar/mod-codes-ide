import loader from "@monaco-editor/loader";

let monacoPromise = null;

export function loadMonaco() {
  if (!monacoPromise) {
    monacoPromise = loader.init();
  }
  return monacoPromise;
}

const LANGUAGE_BY_EXTENSION = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  cjsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  json: "json",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
  c: "c",
  rs: "rust",
};

export function getLanguageFromPath(path) {
  const dotIndex = path.lastIndexOf(".");

  if (dotIndex === -1 || dotIndex === path.length - 1) {
    return "plaintext";
  }

  const extension = path.slice(dotIndex + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] || "plaintext";
}