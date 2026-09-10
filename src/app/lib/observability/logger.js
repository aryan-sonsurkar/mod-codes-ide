const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const LEVEL_NAMES = ["DEBUG", "INFO", "WARN", "ERROR"];

function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    let s = value;
    if (s.length > 500) s = s.slice(0, 500) + "...";
    return s;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitize).slice(0, 10);
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 15);
    for (const k of keys) {
      const lk = k.toLowerCase();
      if (
        lk.includes("secret") ||
        lk.includes("token") ||
        lk.includes("password") ||
        lk.includes("apikey") ||
        lk.includes("api_key") ||
        lk.includes("authorization")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitize(value[k]);
      }
    }
    return out;
  }
  return String(value).slice(0, 200);
}

const SENSITIVE_KEYS = new Set([
  "source",
  "code",
  "prompt",
  "response",
  "aiResponse",
  "terminal",
  "command",
  "output",
  "stdout",
  "stderr",
  "fileContents",
  "content",
  "secret",
  "token",
  "password",
  "apikey",
  "api_key",
  "authorization",
]);

function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = sanitize(v);
    }
  }
  return out;
}

let _minLevel = typeof process !== "undefined" && process.env?.NODE_ENV === "production" ? LEVELS.WARN : LEVELS.DEBUG;
let _handlers = [];
let _version = "0.1.0";
let _environment = typeof process !== "undefined" && process.env?.NODE_ENV === "production" ? "production" : "development";

function createLogger(component) {
  function log(level, message, context) {
    if (level < _minLevel) return;
    let safeContext;
    try {
      safeContext = sanitizeContext(context);
    } catch {
      safeContext = {};
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level],
      component: component || "app",
      message: String(message || "").slice(0, 500),
      context: safeContext,
      version: _version,
      environment: _environment,
    };
    for (const handler of _handlers) {
      try { handler(entry); } catch {}
    }
    if (typeof console !== "undefined") {
      const prefix = `[${entry.level}] [${entry.component}]`;
      if (level >= LEVELS.ERROR) {
        console.error(prefix, entry.message, entry.context);
      } else if (level >= LEVELS.WARN) {
        console.warn(prefix, entry.message, entry.context);
      } else if (_environment !== "production") {
        console.log(prefix, entry.message, entry.context);
      }
    }
  }

  return {
    debug: (msg, ctx) => log(LEVELS.DEBUG, msg, ctx),
    info: (msg, ctx) => log(LEVELS.INFO, msg, ctx),
    warn: (msg, ctx) => log(LEVELS.WARN, msg, ctx),
    error: (msg, ctx) => log(LEVELS.ERROR, msg, ctx),
    child: (subComponent) => createLogger(component ? `${component}:${subComponent}` : subComponent),
  };
}

function setLogLevel(level) {
  if (typeof level === "string") {
    const idx = LEVEL_NAMES.indexOf(level.toUpperCase());
    if (idx >= 0) _minLevel = idx;
  } else if (typeof level === "number") {
    _minLevel = level;
  }
}

function addLogHandler(handler) {
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

const logger = createLogger("app");

export {
  createLogger,
  setLogLevel,
  addLogHandler,
  setVersion,
  setEnvironment,
  sanitizeContext,
  sanitize,
  LEVELS,
  LEVEL_NAMES,
  SENSITIVE_KEYS,
};

export default logger;
