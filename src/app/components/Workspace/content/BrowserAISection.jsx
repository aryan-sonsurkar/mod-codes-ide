"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, RefreshCw, Trash2, Zap } from "lucide-react";
import {
  MODEL_STATES,
  describeCapability,
  describeDeviceTier,
  describeDownload,
  downloadModel,
  formatBytes,
  hardwareTier,
  isWebGpuAvailable,
} from "../../../lib/ai";
import "./AIPanel.css";

const BROWSER_MODEL_ID = "bonsai-1.7b";
const CACHE_NAME = "modcodes-ai-v1";

function stateBadge(state) {
  switch (state) {
    case MODEL_STATES.downloaded:
    case MODEL_STATES.ready:
      return { label: "Ready in browser", kind: "ok" };
    case MODEL_STATES.downloading:
      return { label: "Downloading", kind: "progress" };
    case MODEL_STATES.loading:
      return { label: "Loading", kind: "progress" };
    case MODEL_STATES.error:
      return { label: "Download failed", kind: "error" };
    case MODEL_STATES.incompatible:
      return { label: "Not supported here", kind: "error" };
    default:
      return { label: "Not downloaded", kind: "muted" };
  }
}

export default function BrowserAISection({
  capability,
  registry,
  onStateChange = () => {},
}) {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const cacheProvider = useMemo(
    () =>
      typeof caches !== "undefined" && caches
        ? { open: (name) => caches.open(name || CACHE_NAME) }
        : null,
    []
  );

  const handleDownload = useCallback(async () => {
    if (!registry) {
      return;
    }
    const info = await registry.getModel(BROWSER_MODEL_ID);
    const model = info && info.model;
    if (!model || busy) {
      return;
    }
    setBusy(true);
    setProgress({
      state: "downloading",
      filesDone: 0,
      filesTotal: model.files.length,
      bytesLoaded: 0,
      bytesTotal: info.downloadBytes,
      error: null,
    });
    try {
      const result = await downloadModel({
        model,
        registry,
        cacheProvider,
        onProgress: (next) => setProgress(next),
      });
      setProgress(result);
      onStateChange(await registry.getModel(BROWSER_MODEL_ID));
    } catch {
      // downloadModel already surfaced the error state via progress
    } finally {
      setBusy(false);
    }
  }, [registry, busy, cacheProvider, onStateChange]);

  const handleEvict = useCallback(async () => {
    if (!registry) {
      return;
    }
    setBusy(true);
    try {
      await registry.evictModel(BROWSER_MODEL_ID);
      setProgress(null);
      onStateChange(await registry.getModel(BROWSER_MODEL_ID));
    } finally {
      setBusy(false);
    }
  }, [registry, onStateChange]);

  if (!capability || !registry) {
    return (
      <section className="ai-browser">
        <div className="ai-browser-header">
          <Zap size={13} />
          <span>Browser AI — Bonsai</span>
          <span className="ai-browser-webgpu">Checking WebGPU support…</span>
        </div>
      </section>
    );
  }

  const webgpuOk = isWebGpuAvailable(capability);
  const webgpuText = describeCapability(capability);

  return (
    <BrowserAISectionBody
      registry={registry}
      webgpuOk={webgpuOk}
      webgpuText={webgpuText}
      progress={progress}
      busy={busy}
      onDownload={handleDownload}
      onEvict={handleEvict}
    />
  );
}

function BrowserAISectionBody({
  registry,
  webgpuOk,
  webgpuText,
  progress,
  busy,
  onDownload,
  onEvict,
}) {
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    let active = true;
    window.setTimeout(async () => {
      if (!active) {
        return;
      }
      setModelInfo(await registry.getModel("bonsai-1.7b"));
    }, 0);
    return () => {
      active = false;
    };
  }, [registry]);

  const state = modelInfo ? modelInfo.state : null;
  const badge = stateBadge(state);
  const compatibility = modelInfo ? modelInfo.compatibility : null;
  const downloadLabel = describeDownload(progress);
  const deviceTier = hardwareTier(
    typeof navigator !== "undefined" && typeof navigator.deviceMemory === "number"
      ? navigator.deviceMemory
      : null
  );

  return (
    <section className="ai-browser">
      <div className="ai-browser-header">
        <Zap size={13} />
        <span>Browser AI — Bonsai</span>
        <span
          className={
            webgpuOk
              ? "ai-browser-webgpu ai-browser-webgpu-ok"
              : "ai-browser-webgpu ai-browser-webgpu-error"
          }
        >
          {webgpuText}
        </span>
      </div>

      {deviceTier && (
        <div className="ai-browser-tier">
          Device tier: <strong>{describeDeviceTier(deviceTier)}</strong> — Bonsai
          is designed to fit small and medium devices.
        </div>
      )}

      {modelInfo && modelInfo.model ? (
        <div className="ai-browser-model">
          <div className="ai-browser-model-row">
            <span className="ai-browser-model-name">{modelInfo.model.displayName}</span>
            <span className="ai-browser-model-size">
              {formatBytes(modelInfo.model.downloadBytes)}
            </span>
            <span className={`ai-browser-badge ai-browser-badge-${badge.kind}`}>
              {badge.label}
            </span>
          </div>

          {progress && progress.state === "downloading" && (
            <div className="ai-browser-progress">
              <div className="ai-browser-progress-track">
                <div
                  className={
                    downloadLabel.hasPercent
                      ? "ai-browser-progress-fill"
                      : "ai-browser-progress-indeterminate"
                  }
                  style={
                    downloadLabel.hasPercent
                      ? { width: `${downloadLabel.percent}%` }
                      : undefined
                  }
                />
              </div>
              <span className="ai-browser-progress-label">
                {downloadLabel.label}
              </span>
            </div>
          )}

          {state === MODEL_STATES.downloading && !progress && (
            <div className="ai-browser-progress">
              <div className="ai-browser-progress-track">
                <div className="ai-browser-progress-indeterminate" />
              </div>
              <span className="ai-browser-progress-label">Starting download…</span>
            </div>
          )}

          {state === MODEL_STATES.incompatible && compatibility && (
            <p className="ai-browser-message ai-browser-message-error">
              {compatibility.message}
            </p>
          )}

          {state === MODEL_STATES.error && (
            <p className="ai-browser-message ai-browser-message-error">
              {progress && progress.error ? progress.error : "The download failed."}
            </p>
          )}

          <div className="ai-browser-actions">
            {state === MODEL_STATES.notDownloaded && (
              <button
                type="button"
                className="ai-browser-button"
                onClick={onDownload}
                disabled={busy || !webgpuOk}
              >
                <Download size={12} />
                Download model
              </button>
            )}
            {(state === MODEL_STATES.downloaded || state === MODEL_STATES.ready) && (
              <>
                <span className="ai-browser-ready">
                  <Check size={12} />
                  The model runs locally on your GPU.
                </span>
                <button
                  type="button"
                  className="ai-browser-button ai-browser-button-secondary"
                  onClick={onEvict}
                  disabled={busy}
                >
                  <Trash2 size={12} />
                  Remove from this browser
                </button>
              </>
            )}
            {state === MODEL_STATES.error && (
              <button
                type="button"
                className="ai-browser-button"
                onClick={onDownload}
                disabled={busy}
              >
                <RefreshCw size={12} />
                Retry download
              </button>
            )}
            {state === MODEL_STATES.downloading && (
              <span className="ai-browser-message">Keep this tab open while downloading.</span>
            )}
          </div>
        </div>
      ) : (
        <p className="ai-browser-message">Bonsai is not available in this browser.</p>
      )}
    </section>
  );
}