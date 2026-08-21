import {
  cacheWeight,
  hasCachedWeight,
  normalizeStorageError,
  openWeightCache,
} from "./cache";

export const DOWNLOAD_STATES = {
  idle: "idle",
  downloading: "downloading",
  done: "done",
  error: "error",
  aborted: "aborted",
};

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) {
      break;
    }
    value /= 1024;
    unit = next;
  }
  const digits =
    value >= 100
      ? Math.round(value).toString()
      : value.toFixed(1).replace(/\.0$/, "");
  return `${digits} ${unit}`;
}

export function downloadPercent(progress) {
  if (!progress) {
    return null;
  }
  const total = progress.bytesTotal;
  if (typeof total !== "number" || !(total > 0)) {
    return null;
  }
  const loaded = progress.bytesLoaded || 0;
  if (loaded >= total) {
    return 100;
  }
  return Math.max(0, Math.min(99, Math.round((loaded / total) * 100)));
}

export function describeDownload(progress) {
  if (!progress) {
    return { label: "Downloading…", percent: null, hasPercent: false };
  }
  if (progress.state === DOWNLOAD_STATES.done) {
    return { label: "Download complete", percent: 100, hasPercent: true };
  }
  if (progress.state === DOWNLOAD_STATES.error) {
    return {
      label: progress.error && typeof progress.error === "string"
        ? progress.error
        : "Download failed.",
      percent: null,
      hasPercent: false,
    };
  }
  const loaded = progress.bytesLoaded || 0;
  const total = progress.bytesTotal;
  const percent = downloadPercent(progress);
  if (typeof total === "number" && total > 0) {
    return {
      label: `${formatBytes(loaded)} of ${formatBytes(total)}`,
      percent,
      hasPercent: true,
    };
  }
  return {
    label: `${formatBytes(loaded)} downloaded`,
    percent: null,
    hasPercent: false,
  };
}

export function createIdleProgress() {
  return {
    state: DOWNLOAD_STATES.idle,
    filesDone: 0,
    filesTotal: 0,
    bytesLoaded: 0,
    bytesTotal: null,
    error: null,
  };
}

export function isAbortedError(error) {
  return Boolean(
    error && (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

async function readBodyToBytes(response, onChunk) {
  if (!response || !response.body || typeof response.body.getReader !== "function") {
    const buffer = await response.arrayBuffer();
    onChunk(buffer.byteLength);
    return new Uint8Array(buffer);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onChunk(loaded);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore lock release errors
    }
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Downloads a model's declared files into the browser weight cache with
 * honest progress reporting.
 *
 * - Bytes reported are real (streamed reader counts); when the total is
 *   unknown, `bytesTotal` is null and the UI must NOT invent a percentage.
 * - Cached files are skipped (a partially completed download resumes by
 *   re-fetching only the missing files; individual partial files are never
 *   treated as cache hits).
 * - Size mismatches against the declared file size fail loudly.
 * - Abort via `signal` maps to the `aborted` state (no error surface).
 */
export async function downloadModel({
  model,
  registry = null,
  cacheProvider = null,
  cacheName = null,
  fetchImpl = typeof fetch === "function" ? fetch : null,
  signal = null,
  onProgress = () => {},
} = {}) {
  if (!model) {
    throw new TypeError("downloadModel requires a model.");
  }
  if (!fetchImpl) {
    const error = new Error("Fetch is unavailable in this environment.");
    if (registry) {
      registry.fail(model.id, error);
    }
    throw error;
  }

  const cache = await openWeightCache(cacheProvider, cacheName);
  if (!cache) {
    const error = new Error("The browser weight cache is unavailable.");
    if (registry) {
      registry.fail(model.id, error);
    }
    throw error;
  }

  const progress = {
    state: DOWNLOAD_STATES.downloading,
    filesDone: 0,
    filesTotal: Array.isArray(model.files) ? model.files.length : 0,
    bytesLoaded: 0,
    bytesTotal: typeof model.downloadBytes === "number" ? model.downloadBytes : null,
    error: null,
  };

  const emit = () => onProgress({ ...progress });

  if (registry) {
    registry.beginDownload(model.id);
  }
  emit();

  try {
    for (const file of model.files) {
      if (signal && signal.aborted) {
        const error = new Error("Download aborted.");
        error.name = "AbortError";
        throw error;
      }

      if (await hasCachedWeight(cache, file.url)) {
        progress.filesDone += 1;
        emit();
        continue;
      }

      const response = await fetchImpl(file.url, { signal: signal || undefined });
      if (!response || !response.ok) {
        throw new Error(
          `Download failed with status ${response ? response.status : "unknown"} for ${file.url}`
        );
      }

      let fileTotal = null;
      if (typeof file.bytes === "number") {
        fileTotal = file.bytes;
      }
      if (response.headers && typeof response.headers.get === "function") {
        const contentLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > 0) {
          fileTotal = contentLength;
        }
      }
      if (typeof fileTotal === "number") {
        progress.bytesTotal = fileTotal;
      }

      const fileStart = progress.bytesLoaded;
      const bytes = await readBodyToBytes(response, (loaded) => {
        progress.bytesLoaded = fileStart + loaded;
        emit();
      });

      if (typeof file.bytes === "number" && bytes.length !== file.bytes) {
        throw new Error(
          `Size mismatch for ${file.path}: expected ${file.bytes} bytes, received ${bytes.length}.`
        );
      }

      const cached = await cacheWeight(cache, file.url, new Response(bytes));
      if (!cached) {
        const storageError = normalizeStorageError(null);
        throw new Error(storageError.code);
      }

      progress.filesDone += 1;
      emit();
    }

    if (registry) {
      await registry.finishDownload(model.id);
    }
    progress.state = DOWNLOAD_STATES.done;
    emit();
    return progress;
  } catch (error) {
    if (isAbortedError(error) || (signal && signal.aborted)) {
      progress.state = DOWNLOAD_STATES.aborted;
      progress.error = "Download aborted.";
      if (registry) {
        registry.resetModel(model.id);
      }
      emit();
      return progress;
    }
    progress.state = DOWNLOAD_STATES.error;
    progress.error =
      typeof error === "string" ? error : error && error.message ? error.message : "Download failed.";
    if (registry) {
      registry.fail(model.id, error);
    }
    emit();
    throw error;
  }
}