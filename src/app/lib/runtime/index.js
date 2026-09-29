import { detectFile } from "./detect";
import { runJavaScript } from "./javascript";
import { runPython, PYODIDE_INDEX_URL } from "./python";
import { buildPreviewDocument, previewSandboxPermissions } from "./html";

export const RUN_TIMEOUTS = {
  javascript: 5000,
  python: 20000,
  html: 0,
};

export function defaultTimeoutFor(language) {
  return RUN_TIMEOUTS[language] || 5000;
}

export async function runFile({
  path,
  code,
  timeoutMs,
  onOutput,
  onStatus,
} = {}) {
  const language = detectFile(path, code);
  const source = typeof code === "string" ? code : "";

  if (!language.runnable) {
    return {
      language,
      stdout: "",
      stderr: `${language.reason}\n`,
      exitCode: 1,
      durationMs: 0,
      timedOut: false,
      cancelled: false,
      preview: null,
    };
  }

  if (language.kind === "html") {
    return {
      language,
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
      timedOut: false,
      cancelled: false,
      preview: buildPreviewDocument(source),
      previewSandbox: previewSandboxPermissions(),
    };
  }

  if (language.kind === "python") {
    const result = await runPython({
      code: source,
      timeoutMs: timeoutMs || defaultTimeoutFor(language.kind),
      onOutput,
      onStatus,
    });
    return { language, ...result, preview: null };
  }

  const result = await runJavaScript({
    code: source,
    timeoutMs: timeoutMs || defaultTimeoutFor(language.kind),
    onOutput,
  });
  return { language, ...result, preview: null };
}

export { detectFile } from "./detect";
export { runJavaScript } from "./javascript";
export {
  runPython,
  warmupPython,
  stopPythonRun,
  resetPythonRuntime,
  isPythonRuntimeSupported,
  isPythonRuntimeReady,
  PYODIDE_INDEX_URL,
} from "./python";
export { buildPreviewDocument, previewSandboxPermissions } from "./html";
export { formatSummary, formatDuration, describeError, splitLines } from "./format";
