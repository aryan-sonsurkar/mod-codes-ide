import { analyzeSource, isSupportedPath, languageForPath } from "./analyzer";
import {
  getAnalysis,
  setAnalysis,
  clearAnalysis,
  clearAllAnalysis,
} from "./cache";

function contentKey(content) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function analyzeFile(path, content) {
  if (!isSupportedPath(path)) {
    return {
      path,
      language: null,
      supported: false,
      approximate: false,
      symbols: [],
      imports: [],
      exports: [],
    };
  }

  const key = contentKey(content || "");
  const cached = getAnalysis(path, key);
  if (cached) {
    return cached;
  }

  const result = analyzeSource(content || "", {
    path,
    language: languageForPath(path),
  });
  setAnalysis(path, key, result);
  return result;
}

export function invalidateFile(path) {
  clearAnalysis(path);
}

export function invalidateAll() {
  clearAllAnalysis();
}

export { isSupportedPath, languageForPath };