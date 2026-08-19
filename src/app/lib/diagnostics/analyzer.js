import { analyzeFile, isSupportedPath } from "../codeIntelligence";
import { SEVERITY, createDiagnostic } from "./model";
import { scanSyntax } from "./syntax";
import { resolveRelativeImport } from "./resolve";

function diagnoseSyntax(path, content, diagnostics, scan) {
  for (const closer of scan.unexpectedClosers) {
    diagnostics.push(
      createDiagnostic({
        path,
        severity: SEVERITY.ERROR,
        message: `Unexpected '${closer.char}'`,
        line: closer.line,
        column: closer.column,
      })
    );
  }

  for (const remainder of scan.openRemainders) {
    diagnostics.push(
      createDiagnostic({
        path,
        severity: SEVERITY.ERROR,
        message: `Unclosed '${remainder.open}' — expected '${remainder.close}'`,
        line: scan.lineCount,
        column: 1,
      })
    );
  }
}

function diagnoseImports(path, content, analysis, diagnostics, filePaths) {
  const lines = content.split("\n");
  const recognizedLines = new Set(analysis.imports.map((entry) => entry.line));

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/^import\b/.test(trimmed) && !recognizedLines.has(i + 1)) {
      diagnostics.push(
        createDiagnostic({
          path,
          severity: SEVERITY.HINT,
          message:
            "Import statement was not recognized (unsupported or malformed syntax)",
          line: i + 1,
          column: trimmed.indexOf("import") + 1,
        })
      );
    }
  }

  for (const entry of analysis.imports) {
    if (!entry.source || !entry.source.startsWith(".")) {
      continue;
    }

    const resolved = resolveRelativeImport(path, entry.source, filePaths);
    if (!resolved) {
      diagnostics.push(
        createDiagnostic({
          path,
          severity: SEVERITY.WARNING,
          message: `Cannot find module '${entry.source}'`,
          line: entry.line,
          column: 1,
        })
      );
    }
  }
}

function diagnoseDuplicates(path, analysis, diagnostics, scan) {
  const seen = new Map();
  const reported = new Set();

  for (const symbol of analysis.symbols) {
    if (symbol.kind !== "function" && symbol.kind !== "class" && symbol.kind !== "variable") {
      continue;
    }

    const depth = scan.braceDepths[symbol.line - 1] ?? 0;
    const key = `${symbol.name}|${symbol.kind}|${depth}`;

    if (seen.has(key)) {
      if (!reported.has(key)) {
        reported.add(key);
        const first = seen.get(key);
        diagnostics.push(
          createDiagnostic({
            path,
            severity: SEVERITY.HINT,
            message: `Possible duplicate declaration of '${symbol.name}' (${symbol.kind})`,
            line: first.line,
            column: first.column,
          })
        );
      }
      continue;
    }

    seen.set(key, { line: symbol.line, column: symbol.column });
  }
}

export function diagnoseFile(path, content, { filePaths = new Set() } = {}) {
  if (typeof content !== "string" || !isSupportedPath(path)) {
    return [];
  }

  const diagnostics = [];
  const analysis = analyzeFile(path, content);
  const scan = scanSyntax(content);

  diagnoseSyntax(path, content, diagnostics, scan);
  diagnoseImports(path, content, analysis, diagnostics, filePaths);
  diagnoseDuplicates(path, analysis, diagnostics, scan);

  return diagnostics;
}