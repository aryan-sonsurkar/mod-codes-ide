"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Download, RefreshCw, Trash2, Zap } from "lucide-react";
import {
  MODEL_STATES,
  describeCapability,
  describeDeviceTier,
  describeDownload,
  downloadModel,
  formatBytes,
  hardwareTier,
  isWebGpuAvailable,
  describeAdapterInfo,
  describeAdapterLimits,
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

function formatSpeed(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return null;
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
  return `~${(seconds / 3600).toFixed(1)}h`;
}

async function checkStoragePressure() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const free = quota - usage;
    return { usage, quota, free, percentUsed: quota > 0 ? (usage / quota) * 100 : null };
  } catch {
    return null;
  }
}

export default function BrowserAISection({
  capability,
  registry,
  onStateChange = () => {},
  onReinitialize = () => {},
}) {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmEvict, setConfirmEvict] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [downloadSpeed, setDownloadSpeed] = useState(null);
  const [downloadEta, setDownloadEta] = useState(null);
  const speedTrackerRef = useRef({ lastBytes: 0, lastTime: 0 });

  const cacheProvider = useMemo(
    () =>
      typeof caches !== "undefined" && caches
        ? { open: (name) => caches.open(name || CACHE_NAME) }
        : null,
    []
  );

  useEffect(() => {
    checkStoragePressure().then(setStorageInfo);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!registry) {
      return;
    }
    const info = await registry.getModel(BROWSER_MODEL_ID);
    const model = info && info.model;
    if (!model || busy) {
      return;
    }

    const storage = await checkStoragePressure();
    setStorageInfo(storage);
    if (storage && storage.free < model.downloadBytes * 1.2) {
      return;
    }

    setBusy(true);
    setDownloadSpeed(null);
    setDownloadEta(null);
    speedTrackerRef.current = { lastBytes: 0, lastTime: Date.now() };
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
        onProgress: (next) => {
          setProgress(next);
          const now = Date.now();
          const tracker = speedTrackerRef.current;
          const elapsed = (now - tracker.lastTime) / 1000;
          if (elapsed >= 0.5 && next.bytesLoaded > tracker.lastBytes) {
            const speed = (next.bytesLoaded - tracker.lastBytes) / elapsed;
            setDownloadSpeed(speed);
            if (next.bytesTotal && speed > 0) {
              const remaining = next.bytesTotal - next.bytesLoaded;
              setDownloadEta(remaining / speed);
            }
            speedTrackerRef.current = { lastBytes: next.bytesLoaded, lastTime: now };
          }
        },
      });
      setProgress(result);
      setDownloadSpeed(null);
      setDownloadEta(null);
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
    setConfirmEvict(false);
    try {
      await registry.evictModel(BROWSER_MODEL_ID);
      setProgress(null);
      onStateChange(await registry.getModel(BROWSER_MODEL_ID));
    } finally {
      setBusy(false);
    }
  }, [registry, onStateChange]);

  const handleUnload = useCallback(async () => {
    if (!registry) {
      return;
    }
    setBusy(true);
    try {
      const info = await registry.getModel(BROWSER_MODEL_ID);
      if (info && info.state === MODEL_STATES.ready) {
        await registry.markUnloading?.(BROWSER_MODEL_ID);
        await registry.finishDownload?.(BROWSER_MODEL_ID);
      }
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
      capability={capability}
      progress={progress}
      busy={busy}
      confirmEvict={confirmEvict}
      storageInfo={storageInfo}
      downloadSpeed={downloadSpeed}
      downloadEta={downloadEta}
      onDownload={handleDownload}
      onEvict={handleEvict}
      onUnload={handleUnload}
      onConfirmEvict={() => setConfirmEvict(true)}
      onCancelEvict={() => setConfirmEvict(false)}
      onReinitialize={onReinitialize}
    />
  );
}

function BrowserAISectionBody({
  registry,
  webgpuOk,
  webgpuText,
  capability,
  progress,
  busy,
  confirmEvict,
  storageInfo,
  downloadSpeed,
  downloadEta,
  onDownload,
  onEvict,
  onUnload,
  onConfirmEvict,
  onCancelEvict,
  onReinitialize,
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
  const speedText = formatSpeed(downloadSpeed);
  const etaText = formatEta(downloadEta);
  const lowStorage = storageInfo && modelInfo && modelInfo.model &&
    storageInfo.free < modelInfo.model.downloadBytes * 1.5;

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

      {lowStorage && (
        <div className="ai-browser-storage-warning">
          <AlertTriangle size={12} />
          <span>Low storage space. Free up disk space before downloading.</span>
        </div>
      )}

      {capability && !isWebGpuAvailable(capability) && capability.state === "lost" && (
        <div className="ai-browser-device-lost">
          <p className="ai-browser-message ai-browser-message-error">
            The WebGPU device was lost. This can happen when the GPU is overloaded or the browser reclaimed resources.
          </p>
          <button
            type="button"
            className="ai-browser-button"
            onClick={onReinitialize}
            disabled={busy}
          >
            <RefreshCw size={12} />
            Reinitialize WebGPU
          </button>
        </div>
      )}

      {capability && isWebGpuAvailable(capability) && (
        <div className="ai-browser-adapter-info">
          {describeAdapterInfo(capability) && (
            <span className="ai-browser-adapter-detail">{describeAdapterInfo(capability)}</span>
          )}
          {describeAdapterLimits(capability) && (
            <span className="ai-browser-adapter-detail">{describeAdapterLimits(capability)}</span>
          )}
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
                {speedText && ` · ${speedText}`}
                {etaText && ` · ${etaText}`}
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
              {progress && progress.error ? progress.error : "Download failed. Check your connection and try again."}
            </p>
          )}

          <div className="ai-browser-actions">
            {state === MODEL_STATES.notDownloaded && (
              <button
                type="button"
                className="ai-browser-button"
                onClick={onDownload}
                disabled={busy || !webgpuOk || lowStorage}
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
                {state === MODEL_STATES.ready && (
                  <button
                    type="button"
                    className="ai-browser-button ai-browser-button-secondary"
                    onClick={onUnload}
                    disabled={busy}
                  >
                    <Trash2 size={12} />
                    Free GPU memory
                  </button>
                )}
                {confirmEvict ? (
                  <div className="ai-browser-confirm-evict">
                    <span className="ai-browser-confirm-text">Remove model from browser cache?</span>
                    <button
                      type="button"
                      className="ai-browser-button ai-browser-button-danger"
                      onClick={onEvict}
                      disabled={busy}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="ai-browser-button"
                      onClick={onCancelEvict}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ai-browser-button ai-browser-button-secondary"
                    onClick={onConfirmEvict}
                    disabled={busy}
                  >
                    <Trash2 size={12} />
                    Remove from this browser
                  </button>
                )}
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
        <p className="ai-browser-message">Bonsai is not available in this browser. Try Chrome or Edge with WebGPU support.</p>
      )}
    </section>
  );
}