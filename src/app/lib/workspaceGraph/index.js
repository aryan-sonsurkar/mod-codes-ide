import { collectFilePaths } from "../diagnostics/resolve";
import { isSupportedPath } from "../codeIntelligence";
import { analyzeSource } from "../codeIntelligence/analyzer";
import { buildWorkspaceGraph } from "./graph";

export {
  buildWorkspaceGraph,
  dependenciesOf,
  dependentsOf,
  detectCircularImports,
} from "./graph";

export async function analyzeWorkspaceGraph(tree, { readFile, openDocuments = [] } = {}) {
  const files = [...collectFilePaths(tree)].filter(isSupportedPath);
  const openByPath = new Map(
    openDocuments
      .filter((doc) => doc && typeof doc.path === "string")
      .map((doc) => [doc.path, doc])
  );
  const importIndex = new Map();
  let analyzedCount = 0;

  for (const path of files) {
    const open = openByPath.get(path);
    let content =
      open && typeof open.content === "string" ? open.content : null;

    if (content === null && readFile) {
      const result = await readFile(path);
      if (result.ok && typeof result.content === "string") {
        content = result.content;
      }
    }

    if (content === null) {
      continue;
    }

    const analysis = analyzeSource(content, { path });
    importIndex.set(path, analysis.imports || []);
    analyzedCount += 1;
  }

  const getAnalysis = (path) => ({
    path,
    imports: importIndex.get(path) || [],
  });

  const graph = buildWorkspaceGraph({ files, getAnalysis });

  return {
    ...graph,
    analyzedCount,
    totalFiles: files.length,
  };
}