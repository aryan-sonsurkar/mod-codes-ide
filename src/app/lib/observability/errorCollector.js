import { createLogger, sanitize, sanitizeContext } from "./logger.js";

const MAX_ERRORS = 50;
const logger = createLogger("observability:errorCollector");

let _errors = [];
let _version = "0.1.0";
let _environment = "development";
let _handlers = [];

function classifySeverity(error) {
  if (!error) return "error";
  const msg = String(error.message || error || "").toLowerCase();
  if (msg.includes("timeout")) return "warn";
  if (msg.includes("cancelled") || msg.includes("abort")) return "info";
  return "error";
}

function captureError(error, context = {}) {
  const severity = classifySeverity(error);
  let safeContext;
  try {
    safeContext = sanitizeContext(context);
  } catch {
    safeContext = {};
  }
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    severity,
    message: sanitize(error?.message || String(error || "Unknown error")),
    name: error?.name || "Error",
    code: error?.code || null,
    stack: sanitizeStack(error?.stack),
    context: safeContext,
    version: _version,
    environment: _environment,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };

  _errors.push(entry);
  if (_errors.length > MAX_ERRORS) {
    _errors = _errors.slice(-MAX_ERRORS);
  }

  try {
    logger.error(`[ErrorBoundary] ${entry.message}`, {
      severity: entry.severity,
      code: entry.code,
      name: entry.name,
      ...context,
    });
  } catch {}

  for (const handler of _handlers) {
    try { handler(entry); } catch {}
  }

  return entry;
}

function sanitizeStack(stack) {
  if (!stack || typeof stack !== "string") return null;
  const lines = stack.split("\n").slice(0, 8);
  return lines
    .map((line) => {
      let l = line.trim();
      if (l.includes("node_modules")) return null;
      if (l.length > 200) l = l.slice(0, 200) + "...";
      return l;
    })
    .filter(Boolean)
    .join("\n");
}

function getRecentErrors(count = 10) {
  return _errors.slice(-count);
}

function getErrorCount() {
  return _errors.length;
}

function clearErrors() {
  _errors = [];
}

function addErrorHandler(handler) {
  if (typeof handler === "function") {
    _handlers.push(handler);
    return () => {
      const idx = _handlers.indexOf(handler);
      if (idx >= 0) _handlers.splice(idx, 1);
    };
  }
  return () => {};
}

function setVersion(version) {
  _version = String(version || "0.1.0");
}

function setEnvironment(env) {
  _environment = String(env || "development");
}

export {
  captureError,
  getRecentErrors,
  getErrorCount,
  clearErrors,
  addErrorHandler,
  setVersion,
  setEnvironment,
  sanitizeStack,
  classifySeverity,
};
