const MAX_OUTPUT_CHARS = 20000;
const MAX_ERROR_CHARS = 6000;

export function clampText(text, limit) {
  const value = typeof text === "string" ? text : "";
  if (value.length <= limit) {
    return { text: value, truncated: false };
  }
  const kept = value.slice(0, limit);
  const dropped = value.length - limit;
  return { text: `${kept}\n… ${dropped} more characters truncated`, truncated: true };
}

export function clampStdout(text) {
  return clampText(text, MAX_OUTPUT_CHARS);
}

export function clampStderr(text) {
  return clampText(text, MAX_ERROR_CHARS);
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0ms";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatSummary({ label, exitCode, durationMs, reason }) {
  const time = formatDuration(durationMs);
  if (reason) {
    return `${label} · ${reason} · ${time}`;
  }
  if (exitCode === 0) {
    return `${label} · exited 0 · ${time}`;
  }
  return `${label} · exited ${exitCode ?? 1} · ${time}`;
}

export function describeError(error) {
  if (error == null) {
    return "Unknown error.";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.name && error.message) {
    return `${error.name}: ${error.message}`;
  }
  if (error.message) {
    return String(error.message);
  }
  return String(error);
}

export function lastPythonFrame(traceback) {
  const lines = String(traceback || "")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return "";
  }
  const fileFrames = lines.filter((line) => line.includes("File "));
  if (fileFrames.length > 0) {
    return fileFrames[fileFrames.length - 1].trim();
  }
  return lines[lines.length - 1].trim();
}

export function splitLines(buffer) {
  const text = typeof buffer === "string" ? buffer : "";
  if (text.length === 0) {
    return [];
  }
  return text.replace(/\n$/, "").split("\n");
}
