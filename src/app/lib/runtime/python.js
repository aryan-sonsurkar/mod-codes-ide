export const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.4/full/";

const DEFAULT_TIMEOUT_MS = 20000;

let worker = null;
let current = null;
let seq = 0;
let runtimeReady = false;

function workerAvailable() {
  return typeof Worker !== "undefined";
}

export function isPythonRuntimeReady() {
  return runtimeReady;
}

function terminate() {
  if (worker) {
    worker.terminate();
    worker = null;
    runtimeReady = false;
  }
}

export function stopPythonRun() {
  const active = current;
  if (!active) {
    return;
  }
  current = null;
  terminate();
  window.clearTimeout(active.timer);
  active.resolve({
    stdout: active.stdout.join(""),
    stderr: `${active.stderr.join("")}Run cancelled.\n`,
    exitCode: 130,
    durationMs: Date.now() - active.startedAt,
    timedOut: false,
    cancelled: true,
  });
}

function handleWorkerMessage(message, active) {
  if (!active || message.id !== active.id) {
    return;
  }

  if (message.type === "ready") {
    if (typeof active.onStatus === "function") {
      active.onStatus("ready");
    }
    return;
  }

  if (message.type === "out" || message.type === "err") {
    const text = message.text || "";
    if (message.type === "out") {
      active.stdout.push(text);
    } else {
      active.stderr.push(text);
    }
    if (typeof active.onOutput === "function") {
      active.onOutput({ type: message.type === "out" ? "stdout" : "stderr", text });
    }
    return;
  }

  if (message.type === "done" || message.type === "fail" || message.type === "fatal") {
    if (message.type !== "done" && message.error) {
      active.stderr.push(`${message.error}\n`);
    }
    if (current === active) {
      current = null;
    }
    window.clearTimeout(active.timer);
    active.resolve({
      stdout: active.stdout.join(""),
      stderr: active.stderr.join(""),
      exitCode: message.type === "done" ? 0 : 1,
      durationMs: Date.now() - active.startedAt,
      timedOut: false,
      cancelled: false,
    });
  }
}

function ensureWorker() {
  if (worker) {
    return worker;
  }
  worker = new Worker("/pyodide-worker.js");
  worker.onmessage = (event) => handleWorkerMessage(event.data || {}, current);
  worker.onerror = () => {
    const active = current;
    current = null;
    terminate();
    if (active) {
      window.clearTimeout(active.timer);
      active.resolve({
        stdout: active.stdout.join(""),
        stderr: "The Python worker crashed. Reload the page and try again.\n",
        exitCode: 1,
        durationMs: Date.now() - active.startedAt,
        timedOut: false,
        cancelled: false,
      });
    }
  };
  return worker;
}

export function isPythonRuntimeSupported() {
  return workerAvailable();
}

export function resetPythonRuntime() {
  stopPythonRun();
  current = null;
  terminate();
}

export function warmupPython({ onStatus } = {}) {
  if (!workerAvailable()) {
    return Promise.resolve({ ok: false, reason: "Web Workers are not available in this browser." });
  }
  stopPythonRun();
  seq += 1;
  const id = `pyodide-warm-${seq}`;

  return new Promise((resolve) => {
    const active = {
      id,
      startedAt: Date.now(),
      stdout: [],
      stderr: [],
      timer: null,
      onStatus,
      onOutput: null,
      resolve,
    };
    current = active;
    active.timer = window.setTimeout(() => {
      if (current !== active) {
        return;
      }
      current = null;
      terminate();
      resolve({ ok: false, reason: "Timed out while downloading the Python runtime." });
    }, 45000);

    ensureWorker().postMessage({ type: "warm", id, indexURL: PYODIDE_INDEX_URL });
  });
}

export function runPython({ code, timeoutMs = DEFAULT_TIMEOUT_MS, onOutput, onStatus } = {}) {
  if (!workerAvailable()) {
    return Promise.resolve({
      stdout: "",
      stderr: "Web Workers are not available, so Python cannot run in this browser.\n",
      exitCode: 1,
      durationMs: 0,
      timedOut: false,
      cancelled: false,
    });
  }

  stopPythonRun();
  seq += 1;
  const id = `pyodide-run-${seq}`;

  return new Promise((resolve) => {
    const active = {
      id,
      startedAt: Date.now(),
      stdout: [],
      stderr: [],
      timer: null,
      onOutput,
      onStatus,
      resolve,
    };
    current = active;

    active.timer = window.setTimeout(() => {
      if (current !== active) {
        return;
      }
      current = null;
      terminate();
      active.stderr.push(
        "Timed out: the script was stopped after exceeding the time limit.\n"
      );
      resolve({
        stdout: active.stdout.join(""),
        stderr: active.stderr.join(""),
        exitCode: 124,
        durationMs: Date.now() - active.startedAt,
        timedOut: true,
        cancelled: false,
      });
    }, Math.max(500, timeoutMs));

    ensureWorker().postMessage({
      type: "run",
      id,
      code: String(code || ""),
      indexURL: PYODIDE_INDEX_URL,
    });
  });
}
