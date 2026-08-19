export { diagnoseFile } from "./analyzer";
export {
  SEVERITY,
  SEVERITY_ORDER,
  createDiagnostic,
  sortDiagnostics,
  groupDiagnosticsByPath,
  countSeverity,
} from "./model";
export { collectFilePaths, normalizePath, resolveRelativeImport } from "./resolve";
export { scanSyntax } from "./syntax";

export function emptyDiagnostics() {
  return [];
}