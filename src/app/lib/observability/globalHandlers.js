import { captureError } from "./errorCollector.js";

let _initialized = false;
let _cleanup = [];

function onWindowError(event) {
  const error = event.error || new Error(event.message || "Unhandled error");
  captureError(error, {
    source: "window.onerror",
    filename: event.filename || null,
    lineno: event.lineno || null,
    colno: event.colno || null,
  });
}

function onUnhandledRejection(event) {
  const reason = event.reason;
  const error =
    reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");
  captureError(error, {
    source: "unhandledrejection",
  });
}

function initGlobalErrorHandlers() {
  if (_initialized) return;
  if (typeof window === "undefined") return;

  _initialized = true;

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  _cleanup = [
    () => window.removeEventListener("error", onWindowError),
    () => window.removeEventListener("unhandledrejection", onUnhandledRejection),
  ];
}

function destroyGlobalErrorHandlers() {
  if (!_initialized) return;
  for (const fn of _cleanup) {
    try { fn(); } catch {}
  }
  _cleanup = [];
  _initialized = false;
}

function isGlobalErrorHandlersInitialized() {
  return _initialized;
}

export {
  initGlobalErrorHandlers,
  destroyGlobalErrorHandlers,
  isGlobalErrorHandlersInitialized,
};
