const EXTENSIONS = ["", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
const INDEX_FILES = ["/index.js", "/index.jsx", "/index.ts", "/index.tsx"];

export function normalizePath(path) {
  const parts = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

export function collectFilePaths(node, output = new Set()) {
  if (!node) {
    return output;
  }

  if (node.kind === "file") {
    output.add(node.path);
    return output;
  }

  if (node.kind === "directory" && Array.isArray(node.children)) {
    for (const child of node.children) {
      collectFilePaths(child, output);
    }
  }

  return output;
}

export function resolveRelativeImport(fromPath, specifier, filePaths) {
  if (typeof specifier !== "string" || !specifier.startsWith(".")) {
    return null;
  }

  const base =
    typeof fromPath === "string" && fromPath.includes("/")
      ? fromPath.slice(0, fromPath.lastIndexOf("/"))
      : "";
  const joined = normalizePath(base ? `${base}/${specifier}` : specifier);

  if (filePaths.has(joined)) {
    return joined;
  }

  for (const extension of EXTENSIONS) {
    if (extension && filePaths.has(joined + extension)) {
      return joined + extension;
    }
  }

  for (const indexFile of INDEX_FILES) {
    if (filePaths.has(joined + indexFile)) {
      return joined + indexFile;
    }
  }

  return null;
}