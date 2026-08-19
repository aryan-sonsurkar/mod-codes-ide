function blankNonCode(text) {
  let out = "";
  let i = 0;
  const n = text.length;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const c = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      } else {
        out += " ";
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        out += "  ";
        i += 2;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }

    if (inString) {
      if (c === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (c === inString) {
        inString = null;
        out += c;
      } else {
        out += " ";
      }
      i += 1;
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      out += "  ";
      i += 2;
      continue;
    }

    if (c === "/" && next === "*") {
      inBlockComment = true;
      out += "  ";
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      inString = c;
      out += c;
      i += 1;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

function parseSpecifiers(text) {
  return text
    .split(",")
    .map((part) => {
      const pieces = part.trim().split(/\s+as\s+/);
      let name = pieces[pieces.length - 1].trim();
      name = name.replace(/^type\s+/, "").trim();
      return name;
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

function extractSource(raw) {
  const matches = raw.match(/["']([^"']+)["']/g);
  if (!matches) {
    return null;
  }
  const last = matches[matches.length - 1];
  return last.slice(1, -1);
}

function parseImportLine(line, raw) {
  const sideEffect = line.match(
    /^\s*import\s+(?:type\s+)?["']([^"']+)["']/
  );
  if (sideEffect) {
    return { source: extractSource(raw) || "", names: [] };
  }

  const namespace = line.match(
    /^\s*import\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/
  );
  if (namespace) {
    return { source: extractSource(raw), names: [namespace[1]] };
  }

  const defaultImport = line.match(
    /^\s*import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,\s*\{([^}]*)\})?\s+from\s+["']([^"']+)["']/
  );
  if (defaultImport) {
    const names = [defaultImport[1]];
    if (defaultImport[2]) {
      names.push(...parseSpecifiers(defaultImport[2]));
    }
    return { source: extractSource(raw), names };
  }

  const namedImport = line.match(
    /^\s*import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/
  );
  if (namedImport) {
    return { source: extractSource(raw), names: parseSpecifiers(namedImport[1]) };
  }

  return null;
}

function parseExportLine(line, raw) {
  const defaultFn = line.match(
    /^\s*export\s+default\s+(?:async\s+)?function\b(?:\s+([A-Za-z_$][\w$]*))?/
  );
  if (defaultFn) {
    return [
      {
        name: defaultFn[1] || "default",
        kind: "function",
        column: defaultFn[1]
          ? line.indexOf(defaultFn[1]) + 1
          : line.indexOf("default") + 1,
      },
    ];
  }

  const defaultClass = line.match(
    /^\s*export\s+default\s+class\b(?:\s+([A-Za-z_$][\w$]*))?/
  );
  if (defaultClass) {
    return [
      {
        name: defaultClass[1] || "default",
        kind: "class",
        column: defaultClass[1]
          ? line.indexOf(defaultClass[1]) + 1
          : line.indexOf("default") + 1,
      },
    ];
  }

  const defaultExpr = line.match(
    /^\s*export\s+default\s+([A-Za-z_$][\w$]*)/
  );
  if (defaultExpr) {
    return [
      {
        name: defaultExpr[1],
        kind: "value",
        column: line.indexOf("default") + 1,
      },
    ];
  }

  const functionExport = line.match(
    /^\s*export\s+(?:async\s+)?function\b(?:\s*\*)?\s+([A-Za-z_$][\w$]*)/
  );
  if (functionExport) {
    return [
      {
        name: functionExport[1],
        kind: "function",
        column: line.indexOf(functionExport[1]) + 1,
      },
    ];
  }

  const classExport = line.match(
    /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/
  );
  if (classExport) {
    return [
      {
        name: classExport[1],
        kind: "class",
        column: line.indexOf(classExport[1]) + 1,
      },
    ];
  }

  const variableExport = line.match(
    /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)/
  );
  if (variableExport) {
    return variableExport[1]
      .split(",")
      .map((part) => part.trim())
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
      .map((name) => ({
        name,
        kind: "variable",
        column: line.indexOf(name) + 1,
      }));
  }

  const namedReExport = line.match(
    /^\s*export\s+\{([^}]*)\}\s*(?:from\s+["']([^"']+)["'])?/
  );
  if (namedReExport) {
    return parseSpecifiers(namedReExport[1]).map((name) => ({
      name,
      kind: "value",
      column: line.indexOf(name) + 1,
      source: line.includes("from") ? extractSource(raw) : undefined,
    }));
  }

  const starReExport = line.match(/^\s*export\s+\*\s+from\s+["']([^"']+)["']/);
  if (starReExport) {
    return [
      { name: "*", kind: "value", source: extractSource(raw), column: 8 },
    ];
  }

  return null;
}

function parseSymbolLine(line) {
  const arrow = line.match(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^;{]*=>/
  );
  if (arrow) {
    return [
      {
        name: arrow[1],
        kind: "function",
        column: line.indexOf(arrow[1]) + 1,
      },
    ];
  }

  const functionDecl = line.match(
    /\b(?:async\s+)?function\b(?:\s*\*)?\s+([A-Za-z_$][\w$]*)/
  );
  if (functionDecl) {
    return [
      {
        name: functionDecl[1],
        kind: "function",
        column: line.indexOf(functionDecl[1]) + 1,
      },
    ];
  }

  const classDecl = line.match(/\bclass\s+([A-Za-z_$][\w$]*)/);
  if (classDecl) {
    return [
      {
        name: classDecl[1],
        kind: "class",
        column: line.indexOf(classDecl[1]) + 1,
      },
    ];
  }

  const variableDecl = line.match(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*=/
  );
  if (variableDecl) {
    return variableDecl[1]
      .split(",")
      .map((part) => part.trim())
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
      .map((name) => ({
        name,
        kind: "variable",
        column: line.indexOf(name) + 1,
      }));
  }

  return [];
}

export function isSupportedPath(path) {
  return /\.(m?[jt]sx?|cjs|mjs)$/i.test(path);
}

export function languageForPath(path) {
  const name = path.toLowerCase();
  if (/\.tsx?$/.test(name)) {
    return name.endsWith(".tsx") ? "typescriptreact" : "typescript";
  }
  if (/\.jsx?$/.test(name)) {
    return name.endsWith(".jsx") ? "javascriptreact" : "javascript";
  }
  if (/\.(cjs|mjs)$/.test(name)) {
    return "javascript";
  }
  return null;
}

export function analyzeSource(content, { path, language } = {}) {
  const result = {
    path,
    language,
    supported: true,
    approximate: false,
    symbols: [],
    imports: [],
    exports: [],
  };

  if (typeof content !== "string" || content.trim() === "") {
    return result;
  }

  const source = blankNonCode(content);
  const lines = source.split("\n");
  const rawLines = content.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const raw = rawLines[i];
    const lineNumber = i + 1;

    const importInfo = parseImportLine(line, raw);
    if (importInfo) {
      result.imports.push({
        ...importInfo,
        line: lineNumber,
        confidence: "high",
      });
      continue;
    }

    const exportInfo = parseExportLine(line, raw);
    if (exportInfo) {
      for (const entry of exportInfo) {
        result.exports.push({ ...entry, line: lineNumber, confidence: "high" });
      }
      for (const symbol of parseSymbolLine(line)) {
        result.symbols.push({ ...symbol, line: lineNumber });
      }
      continue;
    }

    for (const symbol of parseSymbolLine(line)) {
      result.symbols.push({ ...symbol, line: lineNumber });
    }
  }

  return result;
}