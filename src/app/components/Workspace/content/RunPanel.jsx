"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./RunPanel.css";
import { useSettings } from "../../../contexts/SettingsContext";
import {
  detectFile,
  runFile,
  stopPythonRun,
  isPythonRuntimeSupported,
  isPythonRuntimeReady,
  formatSummary,
} from "../../../lib/runtime";

const MAX_ENTRIES = 400;

export default function RunPanel({ source, runToken, onClose }) {
  const { settings } = useSettings();
  const [entries, setEntries] = useState([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewSandbox, setPreviewSandbox] = useState("allow-scripts");
  const [pane, setPane] = useState("output");
  const [pythonState, setPythonState] = useState(() =>
    isPythonRuntimeReady() ? "ready" : "idle"
  );
  const runSeqRef = useRef(0);
  const bodyRef = useRef(null);

  const language = useMemo(
    () => (source && source.path ? detectFile(source.path, source.content) : null),
    [source]
  );

  const pushEntry = useCallback((type, text) => {
    if (!text) {
      return;
    }
    setEntries((current) => {
      const next = [...current, { type, text: text.replace(/\n$/, "") }];
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries, pane]);

  const run = useCallback(async () => {
    if (running) {
      return;
    }
    if (!source || !source.path) {
      setSummary(null);
      pushEntry("sys", "Open a file in the editor, then press Run.");
      return;
    }

    runSeqRef.current += 1;
    const seq = runSeqRef.current;
    const detected = detectFile(source.path, source.content);

    setEntries([]);
    setSummary(null);
    setPreview(null);
    setPane("output");
    setRunning(true);

    if (!detected.runnable) {
      pushEntry("err", detected.reason);
      setSummary(
        formatSummary({
          label: `${source.path} · ${detected.label}`,
          exitCode: 1,
          durationMs: 0,
          reason: "not runnable",
        })
      );
      setRunning(false);
      return;
    }

    if (detected.kind === "python" && !isPythonRuntimeSupported()) {
      pushEntry("err", "Python needs Web Workers, which this browser has disabled.");
      setRunning(false);
      return;
    }

    try {
      const result = await runFile({
        path: source.path,
        code: source.content,
        onOutput: (chunk) => {
          if (runSeqRef.current !== seq) {
            return;
          }
          pushEntry(chunk.type === "stderr" ? "err" : "out", chunk.text);
        },
        onStatus: () => {
          if (runSeqRef.current !== seq) {
            return;
          }
          setPythonState("ready");
        },
      });

      if (runSeqRef.current !== seq) {
        return;
      }

      if (result.preview) {
        setPreview(result.preview);
        setPreviewSandbox(result.previewSandbox || "allow-scripts");
        setPane("preview");
        setSummary(
          formatSummary({
            label: `${source.path} · ${result.language.label}`,
            exitCode: 0,
            durationMs: result.durationMs,
            reason: "preview rendered",
          })
        );
      } else {
        if (result.stderr) {
          pushEntry("err", result.stderr);
        }
        if (!result.stdout && !result.stderr && result.exitCode === 0) {
          pushEntry("sys", "(no output)");
        }
        setSummary(
          formatSummary({
            label: `${source.path} · ${result.language.label}`,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
          })
        );
      }
    } catch (error) {
      pushEntry("err", error && error.message ? error.message : String(error));
      setSummary(
        formatSummary({
          label: `${source.path} · ${detected.label}`,
          exitCode: 1,
          durationMs: 0,
          reason: "failed to start",
        })
      );
    } finally {
      if (runSeqRef.current === seq) {
        setRunning(false);
      }
    }
  }, [running, source, pushEntry]);

  useEffect(() => {
    if (!runToken) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      run();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken]);

  const stop = () => {
    runSeqRef.current += 1;
    stopPythonRun();
    setRunning(false);
    pushEntry("sys", "Stopped.");
  };

  const clear = () => {
    setEntries([]);
    setSummary(null);
    setPreview(null);
    setPane("output");
  };

  const canStop = running && language && language.kind === "python";
  const badge = language ? language.label : "No file";
  const pythonReady = pythonState === "ready" && isPythonRuntimeReady();

  return (
    <section
      className="run-panel"
      style={{
        "--run-font-size": `${settings.terminal.fontSize}px`,
        "--run-font-family": settings.terminal.fontFamily,
      }}
    >
      <header className="run-header">
        <span className="run-title">
          RUN <span className="run-badge">{badge}</span>
          {language && language.runnable ? (
            <span className="run-sandbox" title="Execution sandbox">
              sandboxed
            </span>
          ) : null}
          {language && language.kind === "python" ? (
            <span
              className={`run-python run-python-${pythonReady ? "ready" : "idle"}`}
              data-testid="python-runtime-state"
            >
              {pythonReady
                ? "Python cached"
                : isPythonRuntimeSupported()
                ? "Python downloads once"
                : "Python unavailable"}
            </span>
          ) : null}
        </span>
        <div className="run-header-actions">
          <button
            className="run-action run-action-primary"
            title="Run current file"
            onClick={run}
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>
          {canStop ? (
            <button className="run-action" title="Stop the running script" onClick={stop}>
              Stop
            </button>
          ) : null}
          <button className="run-action" title="Clear output" onClick={clear}>
            Clear
          </button>
          <button className="run-close" title="Close Run panel" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      {preview ? (
        <div className="run-panes" role="tablist" aria-label="Run views">
          <button
            role="tab"
            aria-selected={pane === "output"}
            className={`run-pane-tab${pane === "output" ? " run-pane-tab-active" : ""}`}
            onClick={() => setPane("output")}
          >
            Output
          </button>
          <button
            role="tab"
            aria-selected={pane === "preview"}
            className={`run-pane-tab${pane === "preview" ? " run-pane-tab-active" : ""}`}
            onClick={() => setPane("preview")}
          >
            Preview
          </button>
        </div>
      ) : null}

      <div className="run-body" ref={bodyRef}>
        {pane === "preview" && preview ? (
          <iframe
            className="run-preview"
            title="MODCODES preview"
            sandbox={previewSandbox}
            srcDoc={preview}
          />
        ) : (
          <div className="run-console" data-testid="run-console">
            {entries.length === 0 ? (
              <p className="run-empty">
                {source && source.path
                  ? `Press Run to execute ${source.path} in your browser. Nothing is uploaded.`
                  : "Open a file in the explorer, then press Run."}
              </p>
            ) : null}
            {entries.map((entry, index) => (
              <div
                key={`${index}-${entry.type}`}
                className={`run-line run-line-${entry.type}`}
              >
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="run-footer">
        <span className="run-summary" data-testid="run-summary">
          {summary || (running ? "Running locally…" : "Idle")}
        </span>
        <span className="run-hint">{language ? language.hint || "" : ""}</span>
      </footer>
    </section>
  );
}
